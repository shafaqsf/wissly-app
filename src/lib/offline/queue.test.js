import { beforeEach, describe, expect, it } from 'vitest'

import { enqueueReview, listPendingReviews, removePendingReview } from './queue.js'

/* The pending-review queue, for a rating that could not reach the server —
 * offline, or the request simply failed. `localStorage` rather than
 * IndexedDB: the store never holds more than a handful of small
 * `{artefactId, rating}` records, `localStorage` is synchronous so there is
 * no open/transaction ceremony for that, and — the deciding factor — it is
 * already available in the jsdom environment this suite runs under, so the
 * whole sync path can be driven by the same TDD loop as everything else
 * without a fake-indexeddb dependency. */

beforeEach(() => {
  localStorage.clear()
})

describe('enqueueReview', () => {
  it('stores a rating with an id that survives a page reload', async () => {
    await enqueueReview({ artefactId: 'a1', rating: 3 })

    const pending = await listPendingReviews()
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ artefactId: 'a1', rating: 3 })
    expect(typeof pending[0].id).toBe('string')
  })

  it('keeps the queue in the order ratings arrived', async () => {
    await enqueueReview({ artefactId: 'a1', rating: 3 })
    await enqueueReview({ artefactId: 'a2', rating: 1 })

    const pending = await listPendingReviews()
    expect(pending.map((review) => review.artefactId)).toEqual(['a1', 'a2'])
  })
})

describe('listPendingReviews', () => {
  it('is empty when nothing is queued', async () => {
    await expect(listPendingReviews()).resolves.toEqual([])
  })

  it('tolerates corrupted storage rather than crashing the reader', async () => {
    localStorage.setItem('wissly:pending-reviews', 'not json')

    await expect(listPendingReviews()).resolves.toEqual([])
  })
})

describe('removePendingReview', () => {
  it('drops one entry by id and leaves the rest', async () => {
    await enqueueReview({ artefactId: 'a1', rating: 3 })
    await enqueueReview({ artefactId: 'a2', rating: 1 })
    const [first] = await listPendingReviews()

    await removePendingReview(first.id)

    const pending = await listPendingReviews()
    expect(pending).toHaveLength(1)
    expect(pending[0].artefactId).toBe('a2')
  })
})
