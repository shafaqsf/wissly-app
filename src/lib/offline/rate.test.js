import { describe, expect, it, vi } from 'vitest'

import { submitRating } from './rate.js'

describe('submitRating', () => {
  it('sends the rating straight through while online', async () => {
    const action = vi.fn(async () => ({ dueAt: 't' }))
    const enqueue = vi.fn()

    const result = await submitRating({
      artefactId: 'a1',
      rating: 3,
      action,
      isOnline: () => true,
      enqueue,
    })

    expect(action).toHaveBeenCalledWith({ artefactId: 'a1', rating: 3 })
    expect(enqueue).not.toHaveBeenCalled()
    expect(result).toEqual({ dueAt: 't' })
  })

  it('queues the rating instead of calling the server while offline', async () => {
    const action = vi.fn()
    const enqueue = vi.fn(async () => {})

    const result = await submitRating({
      artefactId: 'a1',
      rating: 3,
      action,
      isOnline: () => false,
      enqueue,
    })

    expect(action).not.toHaveBeenCalled()
    expect(enqueue).toHaveBeenCalledWith({ artefactId: 'a1', rating: 3 })
    expect(result).toEqual({ queued: true })
  })

  it('falls back to the queue when the server call itself fails', async () => {
    const action = vi.fn(async () => {
      throw new Error('network error')
    })
    const enqueue = vi.fn(async () => {})

    const result = await submitRating({
      artefactId: 'a1',
      rating: 3,
      action,
      isOnline: () => true,
      enqueue,
    })

    expect(enqueue).toHaveBeenCalledWith({ artefactId: 'a1', rating: 3 })
    expect(result).toEqual({ queued: true })
  })
})
