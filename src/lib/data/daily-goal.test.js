// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import { dailyGoalFor } from './daily-goal.js'

const NOW = new Date('2026-07-26T09:00:00.000Z')

describe('dailyGoalFor', () => {
  it('returns null for a course that does not exist', async () => {
    const supabase = fakeSupabase({ subjects: { data: null, error: null } })

    await expect(dailyGoalFor(supabase, { subjectId: 'nope', now: NOW })).resolves.toBeNull()
  })

  it('spreads what is due over the days left before the exam', async () => {
    const supabase = fakeSupabase({
      subjects: {
        data: { id: 's1', title: 'Optics', exam_date: '2026-08-05' },
        error: null,
      },
      artefact_schedule: {
        data: [
          { artefact_id: 'a1', next_due_at: '2026-07-26T00:00:00.000Z' },
          { artefact_id: 'a2', next_due_at: '2026-07-27T00:00:00.000Z' },
          { artefact_id: 'a3', next_due_at: '2026-09-01T00:00:00.000Z' }, // after the exam
        ],
        error: null,
      },
      reviews: { data: [], error: null },
    })

    const goal = await dailyGoalFor(supabase, { subjectId: 's1', now: NOW })

    // 26 Jul -> 5 Aug is 10 days; two of the three artefacts fall before the exam.
    expect(goal).toEqual({
      subjectId: 's1',
      subjectTitle: 'Optics',
      examDate: '2026-08-05',
      target: 1,
      remaining: 1,
      horizonDays: 10,
    })
  })

  it('falls back to a fixed lookahead when the course has no exam date', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 's1', title: 'Optics', exam_date: null }, error: null },
      artefact_schedule: {
        data: [{ artefact_id: 'a1', next_due_at: '2026-07-26T00:00:00.000Z' }],
        error: null,
      },
      reviews: { data: [], error: null },
    })

    const goal = await dailyGoalFor(supabase, { subjectId: 's1', now: NOW })

    expect(goal.horizonDays).toBe(7)
    expect(goal.examDate).toBeNull()
  })

  it('subtracts reviews already completed today for that course', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 's1', title: 'Optics', exam_date: '2026-08-05' }, error: null },
      artefact_schedule: {
        data: [
          { artefact_id: 'a1', next_due_at: '2026-08-01T00:00:00.000Z' },
          { artefact_id: 'a2', next_due_at: '2026-08-02T00:00:00.000Z' },
        ],
        error: null,
      },
      reviews: { data: [{ id: 'r1' }], error: null },
    })

    const goal = await dailyGoalFor(supabase, { subjectId: 's1', now: NOW })

    expect(goal.target).toBe(1)
    expect(goal.remaining).toBe(0)
  })

  it('never asks the reviews table when nothing is scheduled', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 's1', title: 'Optics', exam_date: '2026-08-05' }, error: null },
      artefact_schedule: { data: [], error: null },
    })

    await dailyGoalFor(supabase, { subjectId: 's1', now: NOW })

    expect(supabase.query('reviews')).toBeUndefined()
  })

  it('scopes the schedule read to the course', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 's1', title: 'Optics', exam_date: '2026-08-05' }, error: null },
      artefact_schedule: { data: [], error: null },
    })

    await dailyGoalFor(supabase, { subjectId: 's1', now: NOW })

    expect(argsOf(supabase.query('artefact_schedule'), 'eq')).toEqual(['subject_id', 's1'])
  })
})
