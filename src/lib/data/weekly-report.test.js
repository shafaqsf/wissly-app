// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import { gatherWeeklyReportData } from './weekly-report.js'

const NOW = new Date('2026-07-26T09:00:00.000Z')

describe('gathering what a weekly report needs from the base tables', () => {
  it('counts this week\'s reviews and how they were rated', async () => {
    const supabase = fakeSupabase({
      reviews: [
        { data: [{ rating: 3 }, { rating: 3 }, { rating: 1 }, { rating: 4 }], error: null },
        { data: [], error: null },
      ],
      concept_mastery: { data: [], error: null },
      artefact_schedule: { data: [], error: null },
    })

    const result = await gatherWeeklyReportData(supabase, { userId: 'user-1', now: NOW })

    expect(result.reviewsDone).toBe(4)
    expect(result.ratingCounts).toEqual({ 1: 1, 2: 0, 3: 2, 4: 1 })
  })

  it('scopes the review count to the last 7 days, not the account\'s whole history', async () => {
    const supabase = fakeSupabase({
      reviews: [
        { data: [], error: null },
        { data: [], error: null },
      ],
      concept_mastery: { data: [], error: null },
      artefact_schedule: { data: [], error: null },
    })

    await gatherWeeklyReportData(supabase, { userId: 'user-1', now: NOW })

    const [periodCall] = supabase.queries('reviews')
    const [, gte] = argsOf(periodCall, 'gte')
    expect(new Date(NOW.getTime() - new Date(gte).getTime())).toEqual(
      new Date(7 * 24 * 60 * 60 * 1000),
    )
  })

  it('averages current mastery across every scored concept', async () => {
    const supabase = fakeSupabase({
      reviews: [{ data: [], error: null }, { data: [], error: null }],
      concept_mastery: { data: [{ mastery: '0.5' }, { mastery: '1' }], error: null },
      artefact_schedule: { data: [], error: null },
    })

    const result = await gatherWeeklyReportData(supabase, { userId: 'user-1', now: NOW })

    expect(result.masteryNow).toBeCloseTo(0.75)
  })

  it('is mastery 0 rather than NaN when nothing has been scored yet', async () => {
    const supabase = fakeSupabase({
      reviews: [{ data: [], error: null }, { data: [], error: null }],
      concept_mastery: { data: [], error: null },
      artefact_schedule: { data: [], error: null },
    })

    const result = await gatherWeeklyReportData(supabase, { userId: 'user-1', now: NOW })

    expect(result.masteryNow).toBe(0)
  })

  it('counts what is due within the coming week', async () => {
    const supabase = fakeSupabase({
      reviews: [{ data: [], error: null }, { data: [], error: null }],
      concept_mastery: { data: [], error: null },
      artefact_schedule: { data: [{ artefact_id: 'a1' }, { artefact_id: 'a2' }], error: null },
    })

    const result = await gatherWeeklyReportData(supabase, { userId: 'user-1', now: NOW })

    expect(result.dueNext7Days).toBe(2)
  })

  it('counts a streak of consecutive days ending today', async () => {
    const supabase = fakeSupabase({
      reviews: [
        { data: [], error: null },
        {
          data: [
            { reviewed_at: '2026-07-26T08:00:00.000Z' },
            { reviewed_at: '2026-07-25T08:00:00.000Z' },
            { reviewed_at: '2026-07-24T08:00:00.000Z' },
            { reviewed_at: '2026-07-22T08:00:00.000Z' },
          ],
          error: null,
        },
      ],
      concept_mastery: { data: [], error: null },
      artefact_schedule: { data: [], error: null },
    })

    const result = await gatherWeeklyReportData(supabase, { userId: 'user-1', now: NOW })

    // The 22nd is not consecutive with the 24th-26th run, so it does not
    // extend the streak that is still standing today.
    expect(result.streakDays).toBe(3)
  })

  it('is a streak of zero when nothing was reviewed today', async () => {
    const supabase = fakeSupabase({
      reviews: [
        { data: [], error: null },
        { data: [{ reviewed_at: '2026-07-24T08:00:00.000Z' }], error: null },
      ],
      concept_mastery: { data: [], error: null },
      artefact_schedule: { data: [], error: null },
    })

    const result = await gatherWeeklyReportData(supabase, { userId: 'user-1', now: NOW })

    expect(result.streakDays).toBe(0)
  })

  it('has no mastery-before snapshot to offer, and says so rather than guessing', async () => {
    const supabase = fakeSupabase({
      reviews: [{ data: [], error: null }, { data: [], error: null }],
      concept_mastery: { data: [], error: null },
      artefact_schedule: { data: [], error: null },
    })

    const result = await gatherWeeklyReportData(supabase, { userId: 'user-1', now: NOW })

    expect(result.masteryBefore).toBeNull()
  })
})
