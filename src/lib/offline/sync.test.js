import { describe, expect, it, vi } from 'vitest'

import { flushPendingReviews } from './sync.js'

const queued = [
  { id: 'q1', artefactId: 'a1', rating: 3 },
  { id: 'q2', artefactId: 'a2', rating: 1 },
]

function queueOf(entries) {
  return {
    list: vi.fn(async () => entries),
    remove: vi.fn(async () => {}),
  }
}

describe('flushPendingReviews', () => {
  it('does nothing when nothing is queued', async () => {
    const fetchImpl = vi.fn()

    await flushPendingReviews({ fetchImpl, queue: queueOf([]) })

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('posts each queued review to the submit endpoint and removes it once it lands', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }))
    const queue = queueOf([...queued])

    await flushPendingReviews({ fetchImpl, queue })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/review/submit')
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ artefactId: 'a1', rating: 3 })
    expect(queue.remove).toHaveBeenCalledWith('q1')
    expect(queue.remove).toHaveBeenCalledWith('q2')
  })

  it('stops at the first failure, so an offline learner is not hammered with retries', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 }))
    const queue = queueOf([...queued])

    await flushPendingReviews({ fetchImpl, queue })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(queue.remove).not.toHaveBeenCalled()
  })

  it('treats a network error the same as a failed response, not as a crash', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    })
    const queue = queueOf([...queued])

    await expect(flushPendingReviews({ fetchImpl, queue })).resolves.not.toThrow()
    expect(queue.remove).not.toHaveBeenCalled()
  })

  it('keeps going past one review already gone, and still removes it from the queue', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404 }))
    const queue = queueOf([...queued])

    await flushPendingReviews({ fetchImpl, queue })

    // A 404 means the artefact or the queue entry is gone server-side —
    // retrying it forever would never succeed, unlike a 500 or a network
    // error, so this is the one failure that still clears the entry and
    // lets the rest of the queue proceed.
    expect(queue.remove).toHaveBeenCalledWith('q1')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
