'use server'

import { revalidatePath } from 'next/cache'

import { resolveModel } from '@/lib/agent/models.js'
import { runTurn } from '@/lib/agent/run.js'
import { intervalMs } from '@/lib/agent/standing-orders.js'
import { describeUndo, undoRun } from '@/lib/agent/undo.js'
import { actionsFor, runsFor } from '@/lib/data/agent-runs.js'
import { requireUserId } from '@/lib/auth/user.js'
import {
  appendMessage,
  archiveConversation,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  messagesFor,
  renameConversation,
  restoreConversation,
  setConversationMode,
  setMessageStatus,
  setPinned,
} from '@/lib/data/conversations.js'
import {
  createStandingOrder,
  deleteStandingOrder,
  listStandingOrders,
  setStandingOrderEnabled,
  updateStandingOrder,
} from '@/lib/data/standing-orders.js'
import { createClient } from '@/lib/supabase/server.js'

/* The bar's other half.
 *
 * Every action here builds the request-scoped client and hands it on. That is
 * the whole security model: the agent reaches the database as the learner, so
 * row level security is what bounds what a prompt injection in an uploaded
 * PDF can reach. No action in this file may take a client from its caller.
 *
 * Actions return `{ error }` rather than throwing. A thrown server action
 * becomes a generic digest in production, and "something went wrong" is not
 * something the learner can act on. */

async function client() {
  const supabase = await createClient()
  return { supabase, userId: await requireUserId(supabase) }
}

/** Anything longer is a document, and a document is material, not a message. */
const MAX_MESSAGE = 8000

/** A queue that refills itself is a bill rather than a conversation. */
const MAX_DRAIN = 10

export async function listThreadsAction({ archived = false } = {}) {
  const { supabase } = await client()

  try {
    return { threads: await listConversations(supabase, { archived }) }
  } catch (error) {
    return { error: error.message }
  }
}

export async function openThreadAction({ id }) {
  const { supabase } = await client()

  try {
    const [conversation, messages] = await Promise.all([
      getConversation(supabase, { id }),
      messagesFor(supabase, { conversationId: id }),
    ])

    if (!conversation) return { error: 'That conversation is no longer there.' }

    return { conversation, messages }
  } catch (error) {
    return { error: error.message }
  }
}

export async function newThreadAction({ mode = 'chat', subjectId = null } = {}) {
  const { supabase, userId } = await client()

  try {
    return {
      conversation: await createConversation(supabase, { userId, mode, subjectId }),
    }
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Send a message and answer it.
 *
 * Two settings ride along and they are independent of each other. **Mode** says
 * who acts — chat reads, agent writes — and is a property of the thread from
 * this message on. **Model** says which model answers this one line, and is
 * recorded on the message so the transcript can show it. Chat on Sonnet while
 * the Agent works on DeepSeek is an ordinary configuration, and it stays
 * ordinary because nothing here derives one from the other.
 *
 * The queue lives here too. If the thread is already working, the message is
 * stored `queued` and this returns immediately — the learner's text field is
 * never taken away from them, and the message is on the screen before the
 * previous answer has finished. When the run that is in flight ends, it
 * drains what is waiting.
 */
export async function sendMessageAction({ conversationId, content, mode, model }) {
  const { supabase, userId } = await client()

  const text = String(content ?? '').trim()
  if (text === '') return { error: 'Write something first.' }
  if (text.length > MAX_MESSAGE) {
    return { error: 'That is too long for a message. Add it as material instead.' }
  }

  // Before anything is written. A model id the learner mistyped is theirs to
  // correct, not a failed turn to read about in the thread afterwards.
  let chosen = null
  if (model) {
    try {
      // A chosen id is returned as it stands; the environment is only ever
      // read when nothing was chosen, which is not this branch.
      chosen = resolveModel({ chosen: model })
    } catch (error) {
      return { error: error.message }
    }
  }

  try {
    const conversation = await getConversation(supabase, { id: conversationId })
    if (!conversation) return { error: 'That conversation is no longer there.' }

    if (mode && mode !== conversation.mode) {
      await setConversationMode(supabase, { id: conversationId, mode })
      conversation.mode = mode
    }

    const messages = await messagesFor(supabase, { conversationId })
    const busy = messages.some((message) =>
      ['running', 'queued'].includes(message.status),
    )

    const stored = await appendMessage(supabase, {
      userId,
      conversationId,
      role: 'user',
      content: text,
      mode: conversation.mode,
      model: chosen,
      busy,
    })

    revalidatePath('/dashboard')

    if (busy) return { message: stored, queued: true }

    let turn = await runTurn({ supabase, userId, conversation, message: stored })
    const intents = [...(turn.intents ?? [])]

    // Drain what arrived while this turn was running. Bounded, because a
    // queue that refills itself is a bill rather than a conversation.
    for (let drained = 0; turn.next && drained < MAX_DRAIN; drained += 1) {
      turn = await runTurn({ supabase, userId, conversation, message: turn.next })
      intents.push(...(turn.intents ?? []))
    }

    return {
      message: stored,
      answer: turn.message,
      runId: turn.run?.id ?? null,
      // What the agent asked the interface to do. Data; the bar performs it.
      intents,
      // Empty on a turn that finished. On one that died halfway it names what
      // landed, so Undo is a decision rather than a guess.
      completed: turn.completed ?? [],
    }
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Stop the turn that is running.
 *
 * Only the turn. A message the learner queued behind it is left `queued` and
 * runs next: they asked for the turn to end, not for the thing they typed a
 * moment ago to be thrown away. Withdrawing is a separate, deliberate act, and
 * it has its own action below.
 */
export async function stopThreadAction({ conversationId }) {
  const { supabase } = await client()

  try {
    const messages = await messagesFor(supabase, { conversationId })
    const running = messages.filter((message) => message.status === 'running')

    const stopped = []
    for (const message of running) {
      stopped.push(await setMessageStatus(supabase, { id: message.id, status: 'stopped' }))
    }

    return { stopped }
  } catch (error) {
    return { error: error.message }
  }
}

/** Take back a message that has not started. One that has can only be stopped. */
export async function withdrawMessageAction({ conversationId, id }) {
  const { supabase } = await client()

  try {
    const messages = await messagesFor(supabase, { conversationId })
    const waiting = messages.find((message) => message.id === id)

    if (!waiting) return { error: 'That message is no longer there.' }
    if (waiting.status !== 'queued') {
      return { error: 'That one has already started. Stop it instead.' }
    }

    await setMessageStatus(supabase, { id, status: 'stopped' })

    return { withdrawn: true, id }
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * What a reconnecting client resumes from.
 *
 * Every delta of a streamed answer is written to its row as it arrives, so the
 * thread on the server is always the truth. A reload, a closed laptop or a
 * dropped connection reads this and carries on from what is stored rather than
 * starting the answer again.
 */
export async function resumeThreadAction({ conversationId }) {
  const { supabase } = await client()

  try {
    const messages = await messagesFor(supabase, { conversationId })

    return {
      messages,
      running: messages.find((message) => message.status === 'running') ?? null,
      queued: messages.filter((message) => message.status === 'queued'),
    }
  } catch (error) {
    return { error: error.message }
  }
}

export async function renameThreadAction({ id, title }) {
  const { supabase } = await client()

  try {
    return { conversation: await renameConversation(supabase, { id, title }) }
  } catch (error) {
    return { error: error.message }
  }
}

export async function pinThreadAction({ id, pinned }) {
  const { supabase } = await client()

  try {
    return { conversation: await setPinned(supabase, { id, pinned }) }
  } catch (error) {
    return { error: error.message }
  }
}

export async function archiveThreadAction({ id }) {
  const { supabase } = await client()

  try {
    return { conversation: await archiveConversation(supabase, { id }) }
  } catch (error) {
    return { error: error.message }
  }
}

export async function restoreThreadAction({ id }) {
  const { supabase } = await client()

  try {
    return { conversation: await restoreConversation(supabase, { id }) }
  } catch (error) {
    return { error: error.message }
  }
}

/** The one irreversible act. Reachable from the archive, and from nowhere else. */
export async function deleteThreadAction({ id }) {
  const { supabase } = await client()

  try {
    return await deleteConversation(supabase, { id })
  } catch (error) {
    return { error: error.message }
  }
}

/** What one run changed, for the "Undo" the bar offers on a message. */
export async function runActionsAction({ runId }) {
  const { supabase } = await client()

  try {
    const actions = await actionsFor(supabase, { runId })

    return {
      actions: actions.map((action) => ({
        id: action.id,
        tool: action.tool,
        result: action.result,
        undone_at: action.undone_at ?? null,
      })),
      outstanding: actions.filter((action) => action.undo && !action.undone_at).length,
    }
  } catch (error) {
    return { error: error.message }
  }
}

/** Take back one run by name — the Undo on the message that caused it. */
export async function undoRunAction({ runId }) {
  const { supabase } = await client()

  try {
    const result = await undoRun(supabase, { runId })
    revalidateEverythingTheAgentTouches()

    return { message: describeUndo(result), ...result }
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Take back what the agent last changed.
 *
 * The learner does not know what a run is, so they do not have to name one:
 * this finds the most recent run of the thread that actually changed something
 * and reverses it. A run that only read has nothing to take back and is
 * skipped rather than reported as a failure.
 */
export async function undoLastChangeAction({ conversationId }) {
  const { supabase } = await client()

  try {
    const runs = await runsFor(supabase, { conversationId })

    for (const run of runs) {
      const actions = await actionsFor(supabase, { runId: run.id })
      const outstanding = actions.filter((action) => action.undo && !action.undone_at)
      if (outstanding.length === 0) continue

      const result = await undoRun(supabase, { runId: run.id })
      revalidateEverythingTheAgentTouches()

      return { message: describeUndo(result), runId: run.id, ...result }
    }

    return { message: describeUndo({ undone: [], failed: [] }), undone: [], failed: [] }
  } catch (error) {
    return { error: error.message }
  }
}

function revalidateEverythingTheAgentTouches() {
  for (const path of ['/dashboard', '/courses', '/tasks', '/analytics']) {
    revalidatePath(path)
  }
}

/* --- standing orders --------------------------------------------------
 *
 * A surface of its own, beside the history. The runtime that carries them out
 * lives in `src/lib/agent/standing-orders.js` and is called by something with a
 * clock; these are the four things the learner does to them. */

export async function listStandingOrdersAction() {
  const { supabase } = await client()

  try {
    return { orders: await listStandingOrders(supabase) }
  } catch (error) {
    return { error: error.message }
  }
}

/** The schedule is checked here because a schedule nothing can read never runs. */
function assertReadableSchedule(schedule) {
  if (intervalMs(schedule) === null) {
    throw new Error(
      `"${schedule}" is not a schedule anything could act on. Say daily, weekly, monthly, or "every 3 days".`,
    )
  }
}

export async function createStandingOrderAction({ instruction, schedule }) {
  const { supabase, userId } = await client()

  try {
    assertReadableSchedule(schedule)

    return { order: await createStandingOrder(supabase, { userId, instruction, schedule }) }
  } catch (error) {
    return { error: error.message }
  }
}

export async function updateStandingOrderAction({ id, instruction, schedule, enabled }) {
  const { supabase } = await client()

  try {
    if (schedule !== undefined) assertReadableSchedule(schedule)

    return { order: await updateStandingOrder(supabase, { id, instruction, schedule, enabled }) }
  } catch (error) {
    return { error: error.message }
  }
}

export async function setStandingOrderEnabledAction({ id, enabled }) {
  const { supabase } = await client()

  try {
    return { order: await setStandingOrderEnabled(supabase, { id, enabled }) }
  } catch (error) {
    return { error: error.message }
  }
}

/** An order is the one thing the learner can genuinely delete. */
export async function deleteStandingOrderAction({ id }) {
  const { supabase } = await client()

  try {
    return await deleteStandingOrder(supabase, { id })
  } catch (error) {
    return { error: error.message }
  }
}
