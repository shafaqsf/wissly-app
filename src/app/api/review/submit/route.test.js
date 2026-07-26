// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => ({ learner: true })) }))
vi.mock('@/lib/auth/user.js', () => ({ currentUserId: vi.fn(async () => 'u1') }))
vi.mock('@/lib/data/review.js', () => ({
  scheduleFor: vi.fn(async () => ({ artefact_id: 'a1' })),
  fsrsState: vi.fn(() => null),
  recordReview: vi.fn(async () => ({ due_at: '2026-08-01T00:00:00.000Z' })),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { currentUserId } = await import('@/lib/auth/user.js')
const { scheduleFor, recordReview } = await import('@/lib/data/review.js')
const { POST } = await import('./route.js')

beforeEach(() => {
  vi.clearAllMocks()
  currentUserId.mockResolvedValue('u1')
  scheduleFor.mockResolvedValue({ artefact_id: 'a1' })
  recordReview.mockResolvedValue({ due_at: '2026-08-01T00:00:00.000Z' })
})

function post(body) {
  return new Request('http://localhost/api/review/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/* The other half of `flushPendingReviews` — a rating queued offline, and
 * (also) a rating the online path could reach directly. It mirrors
 * `rateArtefactAction` rather than sharing code with it because a Route
 * Handler and a server action take their input differently; the underlying
 * writes are the same two calls. */
describe('POST /api/review/submit', () => {
  it('refuses a signed-out request', async () => {
    currentUserId.mockResolvedValue(null)

    const response = await POST(post({ artefactId: 'a1', rating: 3 }))

    expect(response.status).toBe(401)
  })

  it('records the rating and answers the next due date', async () => {
    const response = await POST(post({ artefactId: 'a1', rating: 3 }))
    const body = await response.json()

    expect(recordReview.mock.calls[0][1]).toMatchObject({ userId: 'u1', artefactId: 'a1', rating: 3 })
    expect(response.status).toBe(200)
    expect(body.dueAt).toBe('2026-08-01T00:00:00.000Z')
  })

  it('answers 404 when the artefact this review names is gone', async () => {
    scheduleFor.mockResolvedValue(null)

    const response = await POST(post({ artefactId: 'ghost', rating: 3 }))

    expect(response.status).toBe(404)
  })

  it('rejects a rating outside 1..4 before writing anything', async () => {
    const response = await POST(post({ artefactId: 'a1', rating: 9 }))

    expect(response.status).toBe(400)
    expect(recordReview).not.toHaveBeenCalled()
  })

  it('rejects a body that is not JSON', async () => {
    const response = await POST(
      new Request('http://localhost/api/review/submit', { method: 'POST', body: 'not json' }),
    )

    expect(response.status).toBe(400)
  })
})
