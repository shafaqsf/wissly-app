import 'server-only'

import { run as sdkRun } from '@openai/agents'

import {
  appendMessage,
  messagesFor,
  nextQueuedMessage,
  setMessageStatus,
} from '../data/conversations.js'
import { endRun, startRun } from '../data/agent-runs.js'
import { agentForMode, citedSections } from './agents.js'
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
 */

/** What the model sees of the conversation so far. */
const HISTORY_LIMIT = 20

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
 * @param {Function} [params.runAgent] the SDK's `run`, injectable for tests
 * @param {Function} [params.createAgent]
 * @param {Function} [params.configure]
 * @returns {Promise<{message: object, run: object, next: object|null}>}
 */
export async function runTurn({
  supabase,
  userId,
  conversation,
  message,
  runAgent = sdkRun,
  createAgent = agentForMode,
  configure = configureAgentRuntime,
  createClient = createOpenRouterClient,
}) {
  const { model } = configure()

  // Counted as tool results arrive so the guardrail can ask, at the end,
  // whether an answer built on the material said where it came from.
  let passagesRead = 0

  const answerRow = await appendMessage(supabase, {
    userId,
    conversationId: conversation.id,
    role: 'assistant',
    content: '',
    mode: conversation.mode,
    busy: false,
  })

  // The run row comes before the agent, not after: in agent mode every action
  // is attributed to a run, and an agent built without one would have nowhere
  // to record what it changed — which is to say, nothing to undo.
  const runRow = await startRun(supabase, {
    userId,
    conversationId: conversation.id,
    messageId: answerRow.id,
    agent: conversation.mode === 'agent' ? 'Steward' : 'Librarian',
    model,
    mode: conversation.mode,
  })

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
  })

  const history = await messagesFor(supabase, { conversationId: conversation.id })

  try {
    const result = await runAgent(agent, transcript(history), {
      onToolResult: () => {
        passagesRead += 1
      },
    })

    const answer = textOf(result)

    const message = await setMessageStatus(supabase, {
      id: answerRow.id,
      status: 'done',
      content: answer,
      anchors: citedSections(answer).map((sectionId) => ({ section_id: sectionId })),
    })

    const run = await endRun(supabase, {
      id: runRow.id,
      status: 'done',
      usage: result?.usage ?? null,
    })

    return {
      message,
      run,
      next: await nextQueuedMessage(supabase, { conversationId: conversation.id }),
    }
  } catch (error) {
    // Guardrails throw, tools throw, and the provider throws. All three end
    // the same way: the learner is told, in the thread, and the queue moves.
    const reason = explain(error)

    const message = await setMessageStatus(supabase, {
      id: answerRow.id,
      status: 'failed',
      content: reason,
    })

    const run = await endRun(supabase, {
      id: runRow.id,
      status: 'failed',
      error: error?.message ?? String(error),
    })

    return {
      message,
      run,
      next: await nextQueuedMessage(supabase, { conversationId: conversation.id }),
    }
  }
}

/** The SDK returns its answer under one of two names depending on the path. */
function textOf(result) {
  if (typeof result === 'string') return result
  return result?.finalOutput ?? result?.output_text ?? ''
}

/**
 * What the learner reads when a turn fails.
 *
 * The guardrail case is not an error in the ordinary sense — the agent
 * answered, and the answer was withheld because it had dropped its citation.
 * Saying that plainly is more useful than a stack trace, and it is honest
 * about why an answer the learner nearly had is not there.
 */
function explain(error) {
  const message = String(error?.message ?? error)

  if (/guardrail/i.test(message)) {
    return 'That answer did not say which passage it came from, so it was withheld. Ask again.'
  }

  return `That did not go through: ${message}`
}
