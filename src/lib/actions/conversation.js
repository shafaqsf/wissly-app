'use server'

import { revalidatePath } from 'next/cache'

import { runTurn } from '@/lib/agent/run.js'
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
  setPinned,
  stopRunningMessages,
} from '@/lib/data/conversations.js'
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
 * The queue lives here. If the thread is already working, the message is
 * stored `queued` and this returns immediately — the learner's text field is
 * never taken away from them, and the message is on the screen before the
 * previous answer has finished. When the run that is in flight ends, it
 * drains what is waiting.
 */
export async function sendMessageAction({ conversationId, content, mode }) {
  const { supabase, userId } = await client()

  const text = String(content ?? '').trim()
  if (text === '') return { error: 'Write something first.' }
  if (text.length > MAX_MESSAGE) {
    return { error: 'That is too long for a message. Add it as material instead.' }
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
      busy,
    })

    revalidatePath('/dashboard')

    if (busy) return { message: stored, queued: true }

    let turn = await runTurn({ supabase, userId, conversation, message: stored })

    // Drain what arrived while this turn was running. Bounded, because a
    // queue that refills itself is a bill rather than a conversation.
    for (let drained = 0; turn.next && drained < 10; drained += 1) {
      turn = await runTurn({
        supabase,
        userId,
        conversation,
        message: turn.next,
      })
    }

    return { message: stored, answer: turn.message }
  } catch (error) {
    return { error: error.message }
  }
}

export async function stopThreadAction({ conversationId }) {
  const { supabase } = await client()

  try {
    return { stopped: await stopRunningMessages(supabase, { conversationId }) }
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
      revalidatePath('/courses')
      revalidatePath('/library')
      revalidatePath('/review')
      revalidatePath('/progress')

      return { message: describeUndo(result), ...result }
    }

    return { message: describeUndo({ undone: [], failed: [] }), undone: [], failed: [] }
  } catch (error) {
    return { error: error.message }
  }
}
