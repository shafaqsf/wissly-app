// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => ({ learner: true })) }))
vi.mock('@/lib/auth/user.js', () => ({ currentUserId: vi.fn(async () => 'u1') }))
vi.mock('@/lib/data/review.js', () => ({ dueArtefacts: vi.fn(async () => []) }))

const { currentUserId } = await import('@/lib/auth/user.js')
const { dueArtefacts } = await import('@/lib/data/review.js')
const { GET } = await import('./route.js')

beforeEach(() => {
  vi.clearAllMocks()
  currentUserId.mockResolvedValue('u1')
})

function get() {
  return new Request('http://localhost/api/review/due')
}

/* The service worker caches this response for offline reading, so it has to
 * be something a plain `fetch` in a worker can call — JSON over GET, cookie
 * auth exactly like every page, no server action involved. */
describe('GET /api/review/due', () => {
  it('refuses a signed-out request', async () => {
    currentUserId.mockResolvedValue(null)

    const response = await GET(get())

    expect(response.status).toBe(401)
  })

  it('answers with what is due for the signed-in learner', async () => {
    dueArtefacts.mockResolvedValue([{ id: 'a1', format: 'flashcard' }])

    const response = await GET(get())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.due).toEqual([{ id: 'a1', format: 'flashcard' }])
  })

  it('reports a read that failed rather than caching an empty queue as correct', async () => {
    dueArtefacts.mockRejectedValue(new Error('database unreachable'))

    const response = await GET(get())

    expect(response.status).toBe(500)
  })
})
