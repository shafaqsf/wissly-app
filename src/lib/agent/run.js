import 'server-only'

import { run as sdkRun } from '@openai/agents'

import { actionsFor, endRun, startRun } from '../data/agent-runs.js'
import {
  appendMessage,
  messagesFor,
  nextQueuedMessage,
  setMessageStatus,
} from '../data/conversations.js'
import { agentForMode, citedSections } from './agents.js'
import { assertLearnerClient } from './guard.js'
import { resolveModel } from './models.js'
import { createOpenRouterClient } from './openrouter.js'
import { configureAgentRuntime } from './runtime.js'

/**
 * One turn: a learner's message goes in, an answer lands in the thread.
 *
 * The shape here is deliberate. The assistant's message row is written
 * **before** the agent is asked anything, at status `running`. That row is
 * what the interface renders as the working state, it is what a reconnecting
 * client finds after a reload, and it is what a failure has somewhere to be
 * reported. A turn that only wrote its row at the end would leave the learner
 * looking at a thread that had forgotten their question.
 *
 * Every exit path ends both rows. A run left at `running` is indistinguishable
 * from one still in flight, and the queue behind it would never drain.
 *
 * Four things happen here rather than in the route that calls it, because all
 * four have to survive the browser leaving:
 *
 * **Streaming is persistence.** Every delta is appended to the stored message
 * as it arrives, not held in memory and written at the end. A reconnecting
 * client resumes from the row, so a closed laptop costs the answer nothing.
 *
 * **Stop is a question asked of the database.** The learner presses Stop in a
 * different request from the one running the turn, so the turn cannot be told
 * — it has to look. It looks between events, at most once a second.
 *
 * **A failure says what got through.** Thirty writes into a run, a dropped
 * connection leaves the library in a state neither the learner nor the agent
 * can describe from memory. `agent_actions` can, so the failure message reads
 * it and names what landed.
 *
 * **The model is per message.** Not per thread, not per mode. Chat on Sonnet
 * while the Agent works on DeepSeek is an ordinary configuration.
 */

/** What the model sees of the conversation so far. */
const HISTORY_LIMIT = 20

/** How often a streaming answer is written down, and Stop is asked about. */
const PERSIST_EVERY_MS = 400

function transcript(messages) {
  return messages
    .filter((message) => message.status === 'done' || message.role === 'user')
    .slice(-HISTORY_LIMIT)
    .map((message) => `${message.role === 'user' ? 'Learner' : 'You'}: ${message.content}`)
    .join('\n\n')
}

/**
 * Run one turn to completion.
 *
 * @param {object} params
 * @param {object} params.supabase request-scoped client, carrying the session
 * @param {string} params.userId
 * @param {object} params.conversation
 * @param {object} params.message the learner's message, already stored
 * @param {'user'|'schedule'} [params.trigger] who asked for this run
 * @param {(event: object) => void} [params.onEvent] the stream, as it happens
 * @param {() => Promise<boolean>} [params.shouldStop] has Stop been pressed?
 * @param {number} [params.persistEveryMs]
 * @param {Function} [params.runAgent] the SDK's `run`, injectable for tests
 * @param {Function} [params.createAgent]
 * @param {Function} [params.configure]
 * @param {Function} [params.createClient]
 * @returns {Promise<{message: object, run: object, next: object|null,
 *   intents: object[], completed: string[]}>}
 */
export async function runTurn({
  supabase,
  userId,
  conversation,
  message,
  trigger = 'user',
  onEvent,
  shouldStop,
  persistEveryMs = PERSIST_EVERY_MS,
  runAgent = sdkRun,
  createAgent = agentForMode,
  configure = configureAgentRuntime,
  createClient = createOpenRouterClient,
}) {
  assertLearnerClient(supabase)

  // Before any row exists. A malformed model id is the learner's mistake to
  // correct, not a failed turn for them to read about in the thread.
  const { model: fallback } = configure()
  const model = resolveModel({
    chosen: message?.model ?? conversation?.model ?? null,
    env: { OPENROUTER_MODEL: fallback },
  })

  // Counted as tool results arrive so the guardrail can ask, at the end,
  // whether an answer built on the material said where it came from.
  let passagesRead = 0

  /** What the agent asked the interface to do. Data; the bar performs it. */
  const intents = []

  const emit = (event) => {
    try {
      onEvent?.(event)
    } catch {
      /* A listener that throws is a broken pipe, not a broken run. */
    }
  }

  const answerRow = await appendMessage(supabase, {
    userId,
    conversationId: conversation.id,
    role: 'assistant',
    content: '',
    mode: conversation.mode,
    model,
    busy: false,
  })

  // The run row comes before the agent, not after: in agent mode every action
  // is attributed to a run, and an agent built without one would have nowhere
  // to record what it changed — which is to say, nothing to undo.
  const runRow = await startRun(supabase, {
    userId,
    conversationId: conversation.id,
    messageId: answerRow.id,
    agent: conversation.mode === 'agent' ? 'Router' : 'Librarian',
    model,
    mode: conversation.mode,
  })

  // `startRun` does not know about triggers and does not need to: `user` is the
  // column default, so only the unattended case is worth a second statement.
  if (trigger === 'schedule') {
    await supabase.from('agent_runs').update({ trigger: 'schedule' }).eq('id', runRow.id)
  }

  const agent = createAgent({
    supabase,
    model,
    mode: conversation.mode,
    userId,
    runId: runRow.id,
    // Artefact generation goes through the structured client, not the SDK: the
    // format schemas and their repair loop already live there, and a second
    // path to the same rows would drift from the first.
    client: conversation.mode === 'agent' ? createClient() : null,
    passagesRead: () => passagesRead,
    onIntent: (intent) => {
      intents.push(intent)
      emit({ type: 'intent', intent })
    },
  })

  const history = await messagesFor(supabase, { conversationId: conversation.id })

  try {
    const result = await runAgent(agent, transcript(history), {
      stream: true,
      onToolResult: () => {
        passagesRead += 1
      },
    })

    const { text, stopped } = await consume(result, {
      supabase,
      messageId: answerRow.id,
      emit,
      shouldStop,
      persistEveryMs,
    })

    const answer = text || textOf(result)

    const finished = await setMessageStatus(supabase, {
      id: answerRow.id,
      status: stopped ? 'stopped' : 'done',
      content: answer,
      anchors: citedSections(answer).map((sectionId) => ({ section_id: sectionId })),
    })

    const run = await endRun(supabase, {
      id: runRow.id,
      status: stopped ? 'stopped' : 'done',
      usage: result?.usage ?? null,
    })

    emit({ type: stopped ? 'stopped' : 'done', content: answer })

    return {
      message: finished,
      run,
      intents,
      completed: [],
      // A stop ends the turn. It does not withdraw what the learner queued
      // behind it — that is a separate act, and withdrawing it here would
      // delete something they never asked to lose.
      next: await nextQueuedMessage(supabase, { conversationId: conversation.id }),
    }
  } catch (error) {
    // Guardrails throw, tools throw, and the provider throws. All three end
    // the same way: the learner is told, in the thread, and the queue moves.
    const completed = await whatLanded(supabase, { runId: runRow.id })
    const reason = explain(error, completed)

    const finished = await setMessageStatus(supabase, {
      id: answerRow.id,
      status: 'failed',
      content: reason,
    })

    const run = await endRun(supabase, {
      id: runRow.id,
      status: 'failed',
      // The run row is read by the surface that lists runs rather than
      // messages, so it carries the same two facts: what broke, and what stood.
      error: [error?.message ?? String(error), completed.length > 0 ? `completed: ${completed.join(', ')}` : '']
        .filter(Boolean)
        .join(' — '),
    })

    emit({ type: 'failed', content: reason, completed })

    return {
      message: finished,
      run,
      intents,
      completed,
      next: await nextQueuedMessage(supabase, { conversationId: conversation.id }),
    }
  }
}

/**
 * Drain a streamed run, writing it down as it arrives.
 *
 * A model that hands the whole answer back at once is not a special case: it
 * yields nothing, `text` comes back empty, and the caller falls through to the
 * final output. That is why this returns the text rather than assuming it.
 */
async function consume(result, { supabase, messageId, emit, shouldStop, persistEveryMs }) {
  if (typeof result?.[Symbol.asyncIterator] !== 'function') {
    return { text: '', stopped: false }
  }

  let text = ''
  let written = ''
  let lastCheck = 0
  let stopped = false

  const persist = async () => {
    if (written === text) return
    written = text
    await setMessageStatus(supabase, { id: messageId, status: 'running', content: text })
  }

  for await (const event of result) {
    const delta = deltaOf(event)

    if (delta) {
      text += delta
      emit({ type: 'delta', text: delta })
    } else {
      const tool = toolOf(event)
      if (tool) emit({ type: 'tool', name: tool })
    }

    const now = Date.now()
    if (now - lastCheck < persistEveryMs) continue
    lastCheck = now

    await persist()

    // Stop is pressed in another request, so it has to be looked up rather
    // than awaited. Asking on the same beat as persisting keeps a stopped run
    // from costing a query per token.
    if (shouldStop && (await shouldStop())) {
      stopped = true
      break
    }
  }

  await persist()

  return { text, stopped }
}

/**
 * The text of one stream event.
 *
 * Defensive about the shape on purpose. The SDK's event names have changed
 * once already, providers differ in which of them they populate, and a run that
 * silently produced no text because an event was called something else would be
 * the hardest failure in this file to see.
 */
function deltaOf(event) {
  if (typeof event === 'string') return event

  const candidates = [
    event?.delta,
    event?.data?.delta,
    event?.data?.choices?.[0]?.delta?.content,
    event?.text,
  ]

  return candidates.find((value) => typeof value === 'string' && value !== '') ?? ''
}

/** The tool name an event names, for the bar to say what is happening. */
function toolOf(event) {
  return (
    event?.item?.rawItem?.name ??
    event?.item?.name ??
    event?.name ??
    null
  )
}

/** The SDK returns its answer under one of two names depending on the path. */
function textOf(result) {
  if (typeof result === 'string') return result
  return result?.finalOutput ?? result?.output_text ?? ''
}

/**
 * Which writes landed before this run stopped being able to write.
 *
 * `agent_actions` is the only honest answer to this. The agent's own account of
 * what it did did not survive the failure that ended it, and asking a model to
 * summarise a run it did not finish is how a learner ends up undoing something
 * that never happened.
 */
async function whatLanded(supabase, { runId }) {
  try {
    const actions = await actionsFor(supabase, { runId })
    return actions.map((action) => action.tool)
  } catch {
    // The report is a courtesy; failing to build it must not replace the
    // failure the learner actually needs to read.
    return []
  }
}

/**
 * What the learner reads when a turn fails.
 *
 * The guardrail case is not an error in the ordinary sense — the agent
 * answered, and the answer was withheld because it had dropped its citation.
 * Saying that plainly is more useful than a stack trace, and it is honest
 * about why an answer the learner nearly had is not there.
 */
function explain(error, completed = []) {
  const message = String(error?.message ?? error)

  const head = /guardrail/i.test(message)
    ? 'That answer did not say which passage it came from, so it was withheld. Ask again.'
    : `That did not go through: ${message}`

  if (completed.length === 0) {
    return `${head} Nothing was changed.`
  }

  const counts = new Map()
  for (const tool of completed) counts.set(tool, (counts.get(tool) ?? 0) + 1)

  const listed = [...counts]
    .map(([tool, times]) => (times === 1 ? tool : `${tool} ×${times}`))
    .join(', ')

  return `${head} ${completed.length} change${completed.length === 1 ? '' : 's'} did land before it stopped: ${listed}. Undo takes them back.`
}
