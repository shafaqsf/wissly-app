// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import { streakFor } from './streak.js'

const NOW = new Date('2026-07-26T18:00:00.000Z')

describe('streakFor', () => {
  it('folds the review log into a streak length and a milestone', async () => {
    const supabase = fakeSupabase({
      reviews: {
        data: [
          { reviewed_at: '2026-07-26T09:00:00.000Z' },
          { reviewed_at: '2026-07-25T09:00:00.000Z' },
        ],
        error: null,
      },
    })

    await expect(streakFor(supabase, { now: NOW })).resolves.toEqual({
      days: 2,
      milestone: null,
    })
  })

  it('names the milestone once the streak reaches one', async () => {
    const reviewedAt = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(NOW.getTime() - index * 24 * 60 * 60 * 1000)
      return { reviewed_at: date.toISOString() }
    })

    const supabase = fakeSupabase({ reviews: { data: reviewedAt, error: null } })

    await expect(streakFor(supabase, { now: NOW })).resolves.toEqual({
      days: 7,
      milestone: 7,
    })
  })

  it('bounds the query to a window rather than reading the whole log', async () => {
    const supabase = fakeSupabase({ reviews: { data: [], error: null } })

    await streakFor(supabase, { now: NOW })

    const call = supabase.query('reviews')
    expect(argsOf(call, 'select')).toEqual(['reviewed_at'])
    expect(argsOf(call, 'gte')?.[0]).toBe('reviewed_at')
  })

  it('is zero with no reviews at all', async () => {
    const supabase = fakeSupabase({ reviews: { data: [], error: null } })

    await expect(streakFor(supabase, { now: NOW })).resolves.toEqual({
      days: 0,
      milestone: null,
    })
  })
})
