// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server.js', () => ({
  createClient: vi.fn(async () => ({ learner: true })),
}))

vi.mock('@/lib/auth/user.js', () => ({
  currentUserId: vi.fn(async () => 'u1'),
}))

vi.mock('@/lib/data/conversations.js', () => ({
  appendMessage: vi.fn(async (_supabase, input) => ({ id: 'm1', status: 'running', ...input })),
  getConversation: vi.fn(async () => ({ id: 'c1', mode: 'chat' })),
  messagesFor: vi.fn(async () => []),
  setConversationMode: vi.fn(async () => ({ id: 'c1', mode: 'agent' })),
}))

vi.mock('@/lib/agent/run.js', () => ({ runTurn: vi.fn() }))

vi.mock('@/lib/actions/conversation.js', () => ({
  sendMessageAction: vi.fn(async () => ({
    message: { id: 'q1', status: 'queued' },
    queued: true,
  })),
  resumeThreadAction: vi.fn(async () => ({ messages: [], running: null, queued: [] })),
}))

const { currentUserId } = await import('@/lib/auth/user.js')
const { appendMessage, messagesFor, setConversationMode } = await import(
  '@/lib/data/conversations.js'
)
const { runTurn } = await import('@/lib/agent/run.js')
const { resumeThreadAction, sendMessageAction } = await import('@/lib/actions/conversation.js')

const { GET, POST, runtime } = await import('./route.js')

/** The SSE wire format, back into objects. */
async function frames(response) {
  const text = await response.text()

  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const lines = block.split('\n')
      const event = lines.find((line) => line.startsWith('event: '))?.slice(7)
      const data = lines.find((line) => line.startsWith('data: '))?.slice(6)
      return { event, data: JSON.parse(data) }
    })
}

function post(body) {
  return new Request('http://localhost/api/agent/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function get(query = '') {
  return new Request(`http://localhost/api/agent/stream${query}`)
}

const ANSWERED = async ({ onEvent }) => {
  onEvent({ type: 'delta', text: 'Hel' })
  onEvent({ type: 'delta', text: 'lo' })
  onEvent({ type: 'done', content: 'Hello' })

  return { message: { id: 'a1' }, run: { id: 'r1' }, next: null, intents: [], completed: [] }
}

beforeEach(() => {
  vi.clearAllMocks()
  currentUserId.mockResolvedValue('u1')
  messagesFor.mockResolvedValue([])
  appendMessage.mockImplementation(async (_supabase, input) => ({
    id: 'm1',
    status: 'running',
    ...input,
  }))
  runTurn.mockImplementation(ANSWERED)
  resumeThreadAction.mockResolvedValue({ messages: [], running: null, queued: [] })
  sendMessageAction.mockResolvedValue({ message: { id: 'q1', status: 'queued' }, queued: true })
})

describe('the turn', () => {
  it('runs on Node, because the agent SDK needs it', () => {
    expect(runtime).toBe('nodejs')
  })

  it('refuses a caller with no session before writing anything', async () => {
    currentUserId.mockResolvedValue(null)

    const response = await POST(post({ conversationId: 'c1', content: 'hi' }))

    expect(response.status).toBe(401)
    expect(appendMessage).not.toHaveBeenCalled()
    expect(runTurn).not.toHaveBeenCalled()
  })

  it('refuses an empty message', async () => {
    const response = await POST(post({ conversationId: 'c1', content: '   ' }))

    expect(response.status).toBe(400)
    expect(runTurn).not.toHaveBeenCalled()
  })

  it('refuses a message with no conversation', async () => {
    const response = await POST(post({ content: 'hi' }))

    expect(response.status).toBe(400)
  })

  it('refuses a model id that is not one', async () => {
    const response = await POST(
      post({ conversationId: 'c1', content: 'hi', model: 'not a model' }),
    )

    expect(response.status).toBe(400)
    expect(runTurn).not.toHaveBeenCalled()
  })

  it('streams the events of the turn as they happen', async () => {
    const response = await POST(post({ conversationId: 'c1', content: 'hi' }))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/text\/event-stream/)

    const sent = await frames(response)

    expect(sent.map((frame) => frame.event)).toEqual(['start', 'delta', 'delta', 'done'])
    expect(sent[0].data.message.id).toBe('m1')
    expect(sent[1].data.text).toBe('Hel')
    expect(sent[3].data.content).toBe('Hello')
  })

  it('records the mode on the thread when it changed', async () => {
    await POST(post({ conversationId: 'c1', content: 'hi', mode: 'agent' }))

    expect(setConversationMode).toHaveBeenCalledWith(expect.anything(), {
      id: 'c1',
      mode: 'agent',
    })
  })

  it('queues rather than streams when a run is already in flight', async () => {
    messagesFor.mockResolvedValue([{ id: 'm0', status: 'running' }])

    const response = await POST(post({ conversationId: 'c1', content: 'hi' }))

    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ queued: true })
    expect(sendMessageAction).toHaveBeenCalledWith({
      conversationId: 'c1',
      content: 'hi',
      mode: undefined,
      model: undefined,
    })
    expect(runTurn).not.toHaveBeenCalled()
  })

  it('reports the queueing action refusing the message', async () => {
    messagesFor.mockResolvedValue([{ id: 'm0', status: 'running' }])
    sendMessageAction.mockResolvedValue({ error: 'That is too long for a message.' })

    const response = await POST(post({ conversationId: 'c1', content: 'hi' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('too long') })
  })

  it('asks the database whether Stop was pressed', async () => {
    await POST(post({ conversationId: 'c1', content: 'hi' }))

    const [call] = runTurn.mock.calls
    expect(typeof call[0].shouldStop).toBe('function')
  })

  it('drains what was queued behind the turn, still streaming', async () => {
    runTurn.mockImplementationOnce(async ({ onEvent }) => {
      onEvent({ type: 'done', content: 'first' })
      return {
        message: { id: 'a1' },
        run: { id: 'r1' },
        next: { id: 'm2' },
        intents: [],
        completed: [],
      }
    })

    const response = await POST(post({ conversationId: 'c1', content: 'hi' }))
    const sent = await frames(response)

    expect(runTurn).toHaveBeenCalledTimes(2)
    expect(sent.filter((frame) => frame.event === 'done')).toHaveLength(2)
  })

  it('reports a turn that threw as a frame rather than a broken stream', async () => {
    runTurn.mockRejectedValue(new Error('the provider fell over'))

    const response = await POST(post({ conversationId: 'c1', content: 'hi' }))
    const sent = await frames(response)

    expect(sent.at(-1).event).toBe('failed')
    expect(sent.at(-1).data.content).toMatch(/provider fell over/)
  })
})

describe('reconnecting', () => {
  it('refuses a caller with no session', async () => {
    currentUserId.mockResolvedValue(null)

    expect((await GET(get('?conversationId=c1'))).status).toBe(401)
  })

  it('refuses a request naming no conversation', async () => {
    expect((await GET(get())).status).toBe(400)
  })

  it('answers with the settled thread when nothing is running', async () => {
    resumeThreadAction.mockResolvedValue({
      messages: [{ id: 'm1', status: 'done' }],
      running: null,
      queued: [],
    })

    const response = await GET(get('?conversationId=c1'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/application\/json/)
    expect(await response.json()).toMatchObject({ running: null })
  })

  it('replays what was persisted, then follows the run to its end', async () => {
    resumeThreadAction.mockResolvedValue({
      messages: [{ id: 'a1', status: 'running', content: 'Hel' }],
      running: { id: 'a1', status: 'running', content: 'Hel' },
      queued: [],
    })

    messagesFor
      .mockResolvedValueOnce([{ id: 'a1', status: 'running', content: 'Hello' }])
      .mockResolvedValue([{ id: 'a1', status: 'done', content: 'Hello there' }])

    const response = await GET(get('?conversationId=c1'))

    expect(response.headers.get('content-type')).toMatch(/text\/event-stream/)

    const sent = await frames(response)

    expect(sent[0].event).toBe('resume')
    expect(sent[0].data.message.content).toBe('Hel')
    expect(sent.map((frame) => frame.event)).toContain('delta')
    expect(sent.at(-1).event).toBe('done')
    expect(sent.at(-1).data.content).toBe('Hello there')
  })
})
