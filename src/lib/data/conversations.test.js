import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase, methodsOf } from './fake-supabase.js'
import {
  appendMessage,
  archiveConversation,
  createConversation,
  deleteConversation,
  listConversations,
  messagesFor,
  nextQueuedMessage,
  renameConversation,
  setMessageStatus,
  setPinned,
  stopRunningMessages,
} from './conversations.js'

const now = () => new Date('2026-07-25T10:00:00.000Z')

describe('listConversations', () => {
  it('hides the archive and puts pinned threads first', async () => {
    const supabase = fakeSupabase({ conversations: { data: [], error: null } })

    await listConversations(supabase)

    const call = supabase.query('conversations')
    expect(argsOf(call, 'is')).toEqual(['archived_at', null])
    expect(call.chain.filter((step) => step.method === 'order').map((s) => s.args)).toEqual([
      ['pinned_at', { ascending: false, nullsFirst: false }],
      ['last_message_at', { ascending: false, nullsFirst: false }],
    ])
  })

  it('shows only the archive when asked for it', async () => {
    const supabase = fakeSupabase({ conversations: { data: [], error: null } })

    await listConversations(supabase, { archived: true })

    expect(argsOf(supabase.query('conversations'), 'not')).toEqual([
      'archived_at',
      'is',
      null,
    ])
  })

  it('returns an empty list rather than nothing when there are no threads', async () => {
    const supabase = fakeSupabase({ conversations: { data: null, error: null } })

    expect(await listConversations(supabase)).toEqual([])
  })
})

describe('createConversation', () => {
  it('stores the owner, because the policy reads that column', async () => {
    const supabase = fakeSupabase({
      conversations: { data: { id: 'c1' }, error: null },
    })

    await createConversation(supabase, { userId: 'u1', mode: 'agent' })

    expect(argsOf(supabase.query('conversations'), 'insert')[0]).toMatchObject({
      user_id: 'u1',
      mode: 'agent',
    })
  })

  it('opens in chat mode, the one that cannot write anything', async () => {
    const supabase = fakeSupabase({
      conversations: { data: { id: 'c1' }, error: null },
    })

    await createConversation(supabase, { userId: 'u1' })

    expect(argsOf(supabase.query('conversations'), 'insert')[0].mode).toBe('chat')
  })

  it('refuses a mode that is neither', async () => {
    const supabase = fakeSupabase()

    await expect(
      createConversation(supabase, { userId: 'u1', mode: 'root' }),
    ).rejects.toThrow(/mode/)
  })
})

describe('renameConversation', () => {
  it('writes the trimmed title', async () => {
    const supabase = fakeSupabase({
      conversations: { data: { id: 'c1' }, error: null },
    })

    await renameConversation(supabase, { id: 'c1', title: '  Martingales  ' })

    expect(argsOf(supabase.query('conversations'), 'update')[0]).toMatchObject({
      title: 'Martingales',
    })
  })

  it('refuses to blank a title', async () => {
    const supabase = fakeSupabase()

    await expect(
      renameConversation(supabase, { id: 'c1', title: '   ' }),
    ).rejects.toThrow(/name/i)
  })
})

describe('setPinned', () => {
  it('stamps the time, so the pinned list has an order', async () => {
    const supabase = fakeSupabase({
      conversations: { data: { id: 'c1' }, error: null },
    })

    await setPinned(supabase, { id: 'c1', pinned: true, now })

    expect(argsOf(supabase.query('conversations'), 'update')[0]).toEqual({
      pinned_at: now().toISOString(),
    })
  })

  it('clears the stamp when unpinned', async () => {
    const supabase = fakeSupabase({
      conversations: { data: { id: 'c1' }, error: null },
    })

    await setPinned(supabase, { id: 'c1', pinned: false })

    expect(argsOf(supabase.query('conversations'), 'update')[0]).toEqual({
      pinned_at: null,
    })
  })
})

describe('archiveConversation', () => {
  it('archives rather than deletes, because the agent has no other way out', async () => {
    const supabase = fakeSupabase({
      conversations: { data: { id: 'c1' }, error: null },
    })

    await archiveConversation(supabase, { id: 'c1', now })

    const call = supabase.query('conversations')
    expect(methodsOf(call)).not.toContain('delete')
    expect(argsOf(call, 'update')[0]).toEqual({
      archived_at: now().toISOString(),
    })
  })
})

describe('deleteConversation', () => {
  it('is a real delete, and it is the learner who reaches it', async () => {
    const supabase = fakeSupabase({ conversations: { data: null, error: null } })

    await deleteConversation(supabase, { id: 'c1' })

    const call = supabase.query('conversations')
    expect(methodsOf(call)).toContain('delete')
    expect(argsOf(call, 'eq')).toEqual(['id', 'c1'])
  })
})

describe('messagesFor', () => {
  it('reads a thread oldest first', async () => {
    const supabase = fakeSupabase({ messages: { data: [], error: null } })

    await messagesFor(supabase, { conversationId: 'c1' })

    const call = supabase.query('messages')
    expect(argsOf(call, 'eq')).toEqual(['conversation_id', 'c1'])
    expect(argsOf(call, 'order')).toEqual(['created_at', { ascending: true }])
  })
})

describe('appendMessage', () => {
  it('queues rather than blocks when a run is already in flight', async () => {
    const supabase = fakeSupabase({
      messages: { data: { id: 'm1' }, error: null },
      conversations: { data: null, error: null },
    })

    await appendMessage(supabase, {
      userId: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: 'and the quadratic variation?',
      busy: true,
    })

    expect(argsOf(supabase.query('messages'), 'insert')[0]).toMatchObject({
      status: 'queued',
      content: 'and the quadratic variation?',
    })
  })

  it('runs straight away when nothing is in flight', async () => {
    const supabase = fakeSupabase({
      messages: { data: { id: 'm1' }, error: null },
      conversations: { data: null, error: null },
    })

    await appendMessage(supabase, {
      userId: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: 'hello',
    })

    expect(argsOf(supabase.query('messages'), 'insert')[0].status).toBe('running')
  })

  it('touches the thread, so the list re-sorts without a second write path', async () => {
    const supabase = fakeSupabase({
      messages: { data: { id: 'm1', created_at: 't' }, error: null },
      conversations: { data: null, error: null },
    })

    await appendMessage(supabase, {
      userId: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: 'hello',
      now,
    })

    expect(argsOf(supabase.query('conversations'), 'update')[0]).toMatchObject({
      last_message_at: now().toISOString(),
      updated_at: now().toISOString(),
    })
  })

  it('refuses an empty message', async () => {
    const supabase = fakeSupabase()

    await expect(
      appendMessage(supabase, {
        userId: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: '  ',
      }),
    ).rejects.toThrow(/empty/i)
  })
})

describe('nextQueuedMessage', () => {
  it('drains the queue in the order it was written', async () => {
    const supabase = fakeSupabase({ messages: { data: null, error: null } })

    await nextQueuedMessage(supabase, { conversationId: 'c1' })

    const call = supabase.query('messages')
    expect(argsOf(call, 'order')).toEqual(['created_at', { ascending: true }])
    expect(methodsOf(call)).toContain('maybeSingle')
    expect(call.chain.filter((s) => s.method === 'eq').map((s) => s.args)).toEqual([
      ['conversation_id', 'c1'],
      ['status', 'queued'],
    ])
  })
})

describe('setMessageStatus', () => {
  it('refuses a status the check constraint would reject anyway', async () => {
    const supabase = fakeSupabase()

    await expect(
      setMessageStatus(supabase, { id: 'm1', status: 'thinking' }),
    ).rejects.toThrow(/status/)
  })

  it('writes content and anchors together with the status', async () => {
    const supabase = fakeSupabase({ messages: { data: { id: 'm1' }, error: null } })

    await setMessageStatus(supabase, {
      id: 'm1',
      status: 'done',
      content: 'A martingale is a fair game.',
      anchors: [{ section_id: 's1', anchor: { page: 4 } }],
    })

    expect(argsOf(supabase.query('messages'), 'update')[0]).toEqual({
      status: 'done',
      content: 'A martingale is a fair game.',
      anchors: [{ section_id: 's1', anchor: { page: 4 } }],
    })
  })
})

describe('stopRunningMessages', () => {
  it('stops what is running and withdraws what was still queued', async () => {
    const supabase = fakeSupabase({ messages: { data: [], error: null } })

    await stopRunningMessages(supabase, { conversationId: 'c1' })

    const call = supabase.query('messages')
    expect(argsOf(call, 'update')[0]).toEqual({ status: 'stopped' })
    expect(argsOf(call, 'in')).toEqual(['status', ['queued', 'running']])
  })
})
