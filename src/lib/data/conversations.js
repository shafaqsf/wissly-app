import { unwrap, unwrapList } from './result.js'

/* Conversations and the messages in them.
 *
 * Three things in here are load-bearing and easy to mistake for style.
 *
 * **Pinning and archiving are timestamps, not booleans.** A boolean cannot
 * order the pinned list and cannot say when something was archived. Null is
 * the absence of the state.
 *
 * **Archiving is not deleting.** `archiveConversation` writes a column;
 * `deleteConversation` removes the row. The agent only ever reaches the first
 * one — there is exactly one destructive path in the product and it belongs to
 * the learner, in the archive.
 *
 * **`status` is the queue.** A message sent while a run is in flight is
 * written `queued` and rendered immediately, so the text field never has to be
 * taken away. That also makes the queue survive a reload: it is a column, not
 * a promise held in a component.
 */

const CONVERSATION_COLUMNS =
  'id, subject_id, title, mode, pinned_at, archived_at, created_at, updated_at, last_message_at'
const MESSAGE_COLUMNS =
  'id, conversation_id, role, content, mode, status, anchors, created_at'

const MODES = new Set(['chat', 'agent'])
const STATUSES = new Set(['queued', 'running', 'done', 'stopped', 'failed'])
const ROLES = new Set(['user', 'assistant', 'system'])

/** The database has the same check constraints. Failing here says why. */
function assertMode(mode) {
  if (!MODES.has(mode)) {
    throw new Error(`"${mode}" is not a mode. There are two: chat and agent.`)
  }
}

export async function listConversations(supabase, { archived = false } = {}) {
  const query = supabase.from('conversations').select(CONVERSATION_COLUMNS)

  const scoped = archived
    ? query.not('archived_at', 'is', null).order('archived_at', { ascending: false })
    : query
        .is('archived_at', null)
        .order('pinned_at', { ascending: false, nullsFirst: false })
        .order('last_message_at', { ascending: false, nullsFirst: false })

  return unwrapList(await scoped, 'list your conversations')
}

export async function getConversation(supabase, { id }) {
  return unwrap(
    await supabase
      .from('conversations')
      .select(CONVERSATION_COLUMNS)
      .eq('id', id)
      .maybeSingle(),
    'open the conversation',
  )
}

export async function createConversation(
  supabase,
  { userId, subjectId = null, title = null, mode = 'chat' },
) {
  assertMode(mode)

  return unwrap(
    await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        subject_id: subjectId,
        title: title ? String(title).trim() : null,
        mode,
      })
      .select(CONVERSATION_COLUMNS)
      .single(),
    'start the conversation',
  )
}

export async function renameConversation(supabase, { id, title }) {
  const trimmed = String(title ?? '').trim()
  if (trimmed === '') {
    throw new Error('A conversation needs a name. Type one and try again.')
  }

  return unwrap(
    await supabase
      .from('conversations')
      .update({ title: trimmed, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(CONVERSATION_COLUMNS)
      .single(),
    'rename the conversation',
  )
}

export async function setConversationMode(supabase, { id, mode }) {
  assertMode(mode)

  return unwrap(
    await supabase
      .from('conversations')
      .update({ mode })
      .eq('id', id)
      .select(CONVERSATION_COLUMNS)
      .single(),
    'switch mode',
  )
}

/** @param {{now?: () => Date}} options `now` is injected so tests can fix it. */
export async function setPinned(supabase, { id, pinned, now = () => new Date() }) {
  return unwrap(
    await supabase
      .from('conversations')
      .update({ pinned_at: pinned ? now().toISOString() : null })
      .eq('id', id)
      .select(CONVERSATION_COLUMNS)
      .single(),
    pinned ? 'pin the conversation' : 'unpin the conversation',
  )
}

export async function archiveConversation(supabase, { id, now = () => new Date() }) {
  return unwrap(
    await supabase
      .from('conversations')
      .update({ archived_at: now().toISOString() })
      .eq('id', id)
      .select(CONVERSATION_COLUMNS)
      .single(),
    'archive the conversation',
  )
}

export async function restoreConversation(supabase, { id }) {
  return unwrap(
    await supabase
      .from('conversations')
      .update({ archived_at: null })
      .eq('id', id)
      .select(CONVERSATION_COLUMNS)
      .single(),
    'restore the conversation',
  )
}

/**
 * Remove the row. Messages, runs and actions go with it by cascade.
 *
 * The only irreversible act in this module, reachable from the archive and
 * from nowhere else. No agent tool calls it.
 */
export async function deleteConversation(supabase, { id }) {
  unwrap(
    await supabase.from('conversations').delete().eq('id', id),
    'delete the conversation',
  )
  return { id }
}

export async function messagesFor(supabase, { conversationId }) {
  return unwrapList(
    await supabase
      .from('messages')
      .select(MESSAGE_COLUMNS)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
    'read the conversation',
  )
}

/**
 * Write a turn.
 *
 * `busy` decides whether it runs now or waits: the caller knows whether a run
 * is in flight, and passing it in keeps this function from having to ask the
 * database a question it would then race against.
 *
 * The thread's `last_message_at` is touched in the same call. If that write
 * fails the message still stands — a thread sorted a minute stale is a
 * cosmetic fault, and losing what the learner typed is not.
 */
export async function appendMessage(
  supabase,
  {
    userId,
    conversationId,
    role,
    content,
    mode = null,
    busy = false,
    anchors = [],
    now = () => new Date(),
  },
) {
  if (!ROLES.has(role)) throw new Error(`"${role}" is not a role.`)
  if (mode !== null) assertMode(mode)

  const text = String(content ?? '')
  if (role === 'user' && text.trim() === '') {
    throw new Error('That message is empty. Write something and send it again.')
  }

  const message = unwrap(
    await supabase
      .from('messages')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        role,
        content: text,
        mode,
        status: busy ? 'queued' : 'running',
        anchors,
      })
      .select(MESSAGE_COLUMNS)
      .single(),
    'send the message',
  )

  const stamp = now().toISOString()
  await supabase
    .from('conversations')
    .update({ last_message_at: stamp, updated_at: stamp })
    .eq('id', conversationId)

  return message
}

/** The next message waiting in this thread, or null when the queue is empty. */
export async function nextQueuedMessage(supabase, { conversationId }) {
  return unwrap(
    await supabase
      .from('messages')
      .select(MESSAGE_COLUMNS)
      .eq('conversation_id', conversationId)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    'read the queue',
  )
}

/**
 * Move a message along, optionally writing what it now says.
 *
 * Streaming calls this repeatedly with growing `content`; the final call
 * carries the anchors the answer cited.
 */
export async function setMessageStatus(
  supabase,
  { id, status, content, anchors },
) {
  if (!STATUSES.has(status)) {
    throw new Error(`"${status}" is not a message status.`)
  }

  return unwrap(
    await supabase
      .from('messages')
      .update({
        status,
        ...(content === undefined ? {} : { content }),
        ...(anchors === undefined ? {} : { anchors }),
      })
      .eq('id', id)
      .select(MESSAGE_COLUMNS)
      .single(),
    'update the message',
  )
}

/**
 * Stop this thread: what is running stops, what was queued is withdrawn.
 *
 * One statement rather than two, so a message cannot slip from `queued` to
 * `running` between them and survive the stop.
 */
export async function stopRunningMessages(supabase, { conversationId }) {
  return unwrapList(
    await supabase
      .from('messages')
      .update({ status: 'stopped' })
      .eq('conversation_id', conversationId)
      .in('status', ['queued', 'running'])
      .select(MESSAGE_COLUMNS),
    'stop the conversation',
  )
}
