// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import { recallOverTime } from './learning-curve.js'

const NOW = new Date('2026-07-25T12:00:00.000Z')

describe('recallOverTime', () => {
  it('asks for nothing when told neither a course nor a concept', async () => {
    const supabase = fakeSupabase()

    const points = await recallOverTime(supabase, {})

    expect(points).toEqual([])
    expect(supabase.calls).toHaveLength(0)
  })

  it('scopes to one concept when asked for one', async () => {
    const supabase = fakeSupabase({
      artefacts: { data: [{ id: 'art-1' }], error: null },
      reviews: { data: [], error: null },
    })

    await recallOverTime(supabase, { conceptId: 'concept-1', days: 7, now: NOW })

    expect(argsOf(supabase.query('artefacts'), 'eq')).toEqual(['concept_id', 'concept-1'])
  })

  it('scopes to a whole course when no concept is named', async () => {
    const supabase = fakeSupabase({
      artefacts: { data: [{ id: 'art-1' }], error: null },
      reviews: { data: [], error: null },
    })

    await recallOverTime(supabase, { subjectId: 'subject-1', days: 7, now: NOW })

    expect(argsOf(supabase.query('artefacts'), 'eq')).toEqual(['subject_id', 'subject-1'])
  })

  it('has nothing to chart when the course has no artefacts yet', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [], error: null } })

    const points = await recallOverTime(supabase, { subjectId: 'subject-1' })

    expect(points).toEqual([])
    expect(supabase.calls.some((call) => call.table === 'reviews')).toBe(false)
  })

  it('scores each day by (rating - 1) / 3, averaged, and leaves a quiet day as null rather than zero', async () => {
    const supabase = fakeSupabase({
      artefacts: { data: [{ id: 'art-1' }], error: null },
      reviews: {
        data: [
          { rating: 4, reviewed_at: '2026-07-25T06:00:00.000Z' },
          { rating: 2, reviewed_at: '2026-07-25T07:00:00.000Z' },
        ],
        error: null,
      },
    })

    const points = await recallOverTime(supabase, { subjectId: 'subject-1', days: 3, now: NOW })

    expect(points).toHaveLength(3)
    const today = points.at(-1)
    expect(today.date).toBe('2026-07-25')
    expect(today.reviews).toBe(2)
    // (1 + 1/3) / 2 = 2/3
    expect(today.recall).toBeCloseTo(2 / 3, 6)

    const quietDay = points[0]
    expect(quietDay.reviews).toBe(0)
    expect(quietDay.recall).toBeNull()
  })
})
