// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import { reviewLogFor, saveWeights, weightsFor } from './fsrs-weights.js'

describe('reading a learner\'s fitted weights', () => {
  it('is null for a learner nobody has fitted yet, not an error', async () => {
    const supabase = fakeSupabase({ fsrs_weights: { data: null, error: null } })

    await expect(weightsFor(supabase)).resolves.toBeNull()
  })

  it('comes back as numbers, not as whatever Postgres sent for the array', async () => {
    const supabase = fakeSupabase({
      fsrs_weights: {
        data: {
          weights: ['0.5', '1.4', '3.7'],
          review_count: '120',
          loss: '0.41',
          fitted_at: '2026-07-20T09:00:00.000Z',
        },
        error: null,
      },
    })

    const weights = await weightsFor(supabase)

    expect(weights).toEqual({
      weights: [0.5, 1.4, 3.7],
      reviewCount: 120,
      loss: 0.41,
      fittedAt: '2026-07-20T09:00:00.000Z',
    })
  })

  it('scopes to exactly one row, relying on the primary key and RLS rather than a filter', async () => {
    const supabase = fakeSupabase({ fsrs_weights: { data: null, error: null } })

    await weightsFor(supabase)

    expect(supabase.query('fsrs_weights').chain.map((s) => s.method)).toContain('maybeSingle')
  })
})

describe('saving a fit', () => {
  it('upserts on the learner, so recomputing replaces rather than duplicates', async () => {
    const supabase = fakeSupabase({
      fsrs_weights: {
        data: { weights: [0.5, 1.4], review_count: 80, loss: 0.3, fitted_at: '2026-07-25T00:00:00.000Z' },
        error: null,
      },
    })

    await saveWeights(supabase, {
      userId: 'user-1',
      weights: [0.5, 1.4],
      reviewCount: 80,
      loss: 0.3,
      now: new Date('2026-07-25T00:00:00.000Z'),
    })

    const call = supabase.query('fsrs_weights')
    expect(argsOf(call, 'upsert')).toEqual([
      {
        user_id: 'user-1',
        weights: [0.5, 1.4],
        review_count: 80,
        loss: 0.3,
        fitted_at: '2026-07-25T00:00:00.000Z',
      },
      { onConflict: 'user_id' },
    ])
  })
})

describe('reading the log a fit is made from', () => {
  it('asks for every review, oldest first', async () => {
    const supabase = fakeSupabase({ reviews: { data: [], error: null } })

    await reviewLogFor(supabase)

    const call = supabase.query('reviews')
    expect(argsOf(call, 'select')).toEqual(['artefact_id, rating, reviewed_at'])
    expect(argsOf(call, 'order')).toEqual(['reviewed_at', { ascending: true }])
  })

  it('reads no rows as no history, not as a failure', async () => {
    const supabase = fakeSupabase({ reviews: { data: null, error: null } })

    await expect(reviewLogFor(supabase)).resolves.toEqual([])
  })
})
