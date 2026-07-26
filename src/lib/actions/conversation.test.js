// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server.js', () => ({ createClient: async () => ({ learner: true }) }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId: async () => 'u1' }))

vi.mock('@/lib/data/conversations.js', () => ({
  appendMessage: vi.fn(async (_supabase, input) => ({ id: 'm9', ...input })),
  archiveConversation: vi.fn(),
  createConversation: vi.fn(async () => ({ id: 'c1', mode: 'chat' })),
  deleteConversation: vi.fn(),
  getConversation: vi.fn(async () => ({ id: 'c1', mode: 'chat' })),
  listConversations: vi.fn(async () => []),
  messagesFor: vi.fn(async () => []),
  renameConversation: vi.fn(),
  restoreConversation: vi.fn(),
  setConversationMode: vi.fn(async () => ({ id: 'c1', mode: 'agent' })),
  setMessageStatus: vi.fn(async (_supabase, input) => ({ id: input.id, status: input.status })),
  setPinned: vi.fn(),
  stopRunningMessages: vi.fn(),
}))

vi.mock('@/lib/agent/run.js', () => ({
  runTurn: vi.fn(async () => ({ message: { id: 'answer' }, run: { id: 'r1' }, next: null, intents: [], completed: [] })),
}))

vi.mock('@/lib/data/preferences.js', () => ({
  getPreferences: vi.fn(async () => ({ user_id: null, default_model: null, updated_at: null })),
}))

vi.mock('@/lib/data/agent-runs.js', () => ({
  actionsFor: vi.fn(async () => []),
  runsFor: vi.fn(async () => []),
}))

vi.mock('@/lib/agent/undo.js', () => ({
  undoRun: vi.fn(async () => ({ undone: ['make_artefacts'], failed: [] })),
  describeUndo: vi.fn(() => 'Took back 1 change.'),
}))

const {
  appendMessage,
  getConversation,
  messagesFor,
  setMessageStatus,
} = await import('@/lib/data/conversations.js')
const { runTurn } = await import('@/lib/agent/run.js')
const { runsFor, actionsFor } = await import('@/lib/data/agent-runs.js')
const { undoRun } = await import('@/lib/agent/undo.js')
const { getPreferences } = await import('@/lib/data/preferences.js')

const {
  resumeThreadAction,
  sendMessageAction,
  stopThreadAction,
  undoRunAction,
  withdrawMessageAction,
} = await import('./conversation.js')

beforeEach(() => {
  vi.clearAllMocks()
  getConversation.mockResolvedValue({ id: 'c1', mode: 'chat' })
  messagesFor.mockResolvedValue([])
  appendMessage.mockImplementation(async (_supabase, input) => ({ id: 'm9', ...input }))
  runTurn.mockResolvedValue({
    message: { id: 'answer' },
    run: { id: 'r1' },
    next: null,
    intents: [],
    completed: [],
  })
  getPreferences.mockResolvedValue({ user_id: null, default_model: null, updated_at: null })
})

describe('sendMessageAction', () => {
  it('hands the learner’s stored default model to the turn, below whatever this message chose', async () => {
    getPreferences.mockResolvedValue({
      user_id: 'u1',
      default_model: 'deepseek/deepseek-v4-pro',
      updated_at: 't',
    })

    await sendMessageAction({ conversationId: 'c1', content: 'what is a martingale?' })

    expect(runTurn.mock.calls[0][0].preferredModel).toBe('deepseek/deepseek-v4-pro')
  })

  it('records which model was chosen for this message', async () => {
    await sendMessageAction({
      conversationId: 'c1',
      content: 'what is a martingale?',
      model: 'anthropic/claude-sonnet-5',
    })

    expect(appendMessage.mock.calls[0][1]).toMatchObject({
      model: 'anthropic/claude-sonnet-5',
    })
    expect(runTurn.mock.calls[0][0].message.model).toBe('anthropic/claude-sonnet-5')
  })

  it('takes any OpenRouter id, not only the three the bar names', async () => {
    const result = await sendMessageAction({
      conversationId: 'c1',
      content: 'hello',
      model: 'x-ai/grok-9',
    })

    expect(result.error).toBeUndefined()
    expect(appendMessage.mock.calls[0][1].model).toBe('x-ai/grok-9')
  })

  it('refuses a malformed model id before it writes anything', async () => {
    const result = await sendMessageAction({
      conversationId: 'c1',
      content: 'hello',
      model: 'claude',
    })

    expect(result.error).toMatch(/vendor\/model/i)
    expect(appendMessage).not.toHaveBeenCalled()
  })

  it('lets mode and model be set independently in one send', async () => {
    await sendMessageAction({
      conversationId: 'c1',
      content: 'make me ten cards',
      mode: 'agent',
      model: 'deepseek/deepseek-v4-pro',
    })

    expect(appendMessage.mock.calls[0][1]).toMatchObject({
      mode: 'agent',
      model: 'deepseek/deepseek-v4-pro',
    })
  })

  it('queues a message sent while a run is in flight, and answers nothing yet', async () => {
    messagesFor.mockResolvedValue([{ id: 'm1', status: 'running' }])

    const result = await sendMessageAction({ conversationId: 'c1', content: 'and next?' })

    expect(result.queued).toBe(true)
    expect(appendMessage.mock.calls[0][1].busy).toBe(true)
    expect(runTurn).not.toHaveBeenCalled()
  })

  it('hands the intents back, so the bar can perform them', async () => {
    runTurn.mockResolvedValue({
      message: { id: 'answer' },
      run: { id: 'r1' },
      next: null,
      intents: [{ kind: 'navigate', path: '/tasks', query: {} }],
      completed: [],
    })

    const result = await sendMessageAction({ conversationId: 'c1', content: 'make cards' })

    expect(result.intents).toEqual([{ kind: 'navigate', path: '/tasks', query: {} }])
  })

  it('hands back what landed when the run died halfway', async () => {
    runTurn.mockResolvedValue({
      message: { id: 'answer', status: 'failed' },
      run: { id: 'r1', status: 'failed' },
      next: null,
      intents: [],
      completed: ['make_artefacts', 'rename_course'],
    })

    const result = await sendMessageAction({ conversationId: 'c1', content: 'do everything' })

    expect(result.completed).toEqual(['make_artefacts', 'rename_course'])
    expect(result.runId).toBe('r1')
  })

  it('drains the queue in order when the run ends', async () => {
    runTurn
      .mockResolvedValueOnce({
        message: { id: 'a1' },
        run: { id: 'r1' },
        next: { id: 'm2', content: 'the queued one' },
        intents: [],
        completed: [],
      })
      .mockResolvedValueOnce({
        message: { id: 'a2' },
        run: { id: 'r2' },
        next: null,
        intents: [],
        completed: [],
      })

    await sendMessageAction({ conversationId: 'c1', content: 'first' })

    expect(runTurn).toHaveBeenCalledTimes(2)
    expect(runTurn.mock.calls[1][0].message).toMatchObject({ id: 'm2' })
  })
})

describe('stopThreadAction', () => {
  it('stops what is running', async () => {
    messagesFor.mockResolvedValue([
      { id: 'm1', status: 'running' },
      { id: 'm2', status: 'done' },
    ])

    const result = await stopThreadAction({ conversationId: 'c1' })

    expect(setMessageStatus).toHaveBeenCalledTimes(1)
    expect(setMessageStatus.mock.calls[0][1]).toMatchObject({ id: 'm1', status: 'stopped' })
    expect(result.stopped).toHaveLength(1)
  })

  /* The one the design calls out. A learner who queued a follow-up and then
   * stopped the turn asked for the turn to end, not for the thing they just
   * typed to be thrown away. Withdrawing is a separate, deliberate act. */
  it('leaves a queued message queued, so it survives the stop', async () => {
    messagesFor.mockResolvedValue([
      { id: 'm1', status: 'running' },
      { id: 'm2', status: 'queued' },
    ])

    await stopThreadAction({ conversationId: 'c1' })

    const touched = setMessageStatus.mock.calls.map((call) => call[1].id)
    expect(touched).toEqual(['m1'])
    expect(touched).not.toContain('m2')
  })
})

describe('withdrawMessageAction', () => {
  it('withdraws a message that has not started', async () => {
    messagesFor.mockResolvedValue([{ id: 'm2', status: 'queued' }])

    const result = await withdrawMessageAction({ conversationId: 'c1', id: 'm2' })

    expect(setMessageStatus.mock.calls[0][1]).toMatchObject({ id: 'm2', status: 'stopped' })
    expect(result.withdrawn).toBe(true)
  })

  it('refuses to withdraw one that has started — that is Stop’s job', async () => {
    messagesFor.mockResolvedValue([{ id: 'm2', status: 'running' }])

    const result = await withdrawMessageAction({ conversationId: 'c1', id: 'm2' })

    expect(result.error).toMatch(/already/i)
    expect(setMessageStatus).not.toHaveBeenCalled()
  })
})

describe('resumeThreadAction', () => {
  it('reads the thread back from the rows, which is what a reconnect resumes from', async () => {
    messagesFor.mockResolvedValue([
      { id: 'm1', role: 'user', status: 'done' },
      { id: 'm2', role: 'assistant', status: 'running', content: 'half an ans' },
    ])

    const result = await resumeThreadAction({ conversationId: 'c1' })

    expect(result.running).toMatchObject({ id: 'm2', content: 'half an ans' })
    expect(result.messages).toHaveLength(2)
  })

  it('says nothing is in flight when nothing is', async () => {
    messagesFor.mockResolvedValue([{ id: 'm1', role: 'user', status: 'done' }])

    expect((await resumeThreadAction({ conversationId: 'c1' })).running).toBeNull()
  })
})

describe('undoRunAction', () => {
  it('takes back exactly the run the learner pointed at', async () => {
    const result = await undoRunAction({ runId: 'r1' })

    expect(undoRun.mock.calls[0][1]).toEqual({ runId: 'r1' })
    expect(result.message).toBe('Took back 1 change.')
  })
})

describe('every action', () => {
  it('returns an error rather than throwing, because a digest is not actionable', async () => {
    getConversation.mockRejectedValue(new Error('the database is unreachable'))

    expect(await sendMessageAction({ conversationId: 'c1', content: 'hello' })).toEqual({
      error: 'the database is unreachable',
    })
  })

  it('builds its own client and never takes one from its caller', async () => {
    const actions = await import('./conversation.js')

    for (const [name, action] of Object.entries(actions)) {
      expect(typeof action, name).toBe('function')
      // Every action takes one options object, never a client.
      expect(action.length, name).toBeLessThanOrEqual(1)
    }
  })
})
