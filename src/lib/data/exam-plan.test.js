// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import { examPlanFor } from './exam-plan.js'

const NOW = new Date('2026-07-26T09:00:00.000Z')

describe('examPlanFor', () => {
  it('is null for a course that does not exist', async () => {
    const supabase = fakeSupabase({ subjects: { data: null, error: null } })

    await expect(examPlanFor(supabase, { subjectId: 'nope', now: NOW })).resolves.toBeNull()
  })

  it('is null for a course with no exam date, rather than guessing a horizon', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 's1', title: 'Optics', exam_date: null }, error: null },
    })

    await expect(examPlanFor(supabase, { subjectId: 's1', now: NOW })).resolves.toBeNull()
    expect(supabase.query('artefact_schedule')).toBeUndefined()
  })

  it('builds a day-by-day plan from the course schedule', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 's1', title: 'Optics', exam_date: '2026-07-28' }, error: null },
      artefact_schedule: {
        data: [
          {
            artefact_id: 'a1',
            stability: '5',
            next_due_at: '2026-07-27T00:00:00.000Z',
            last_reviewed_at: '2026-07-22T00:00:00.000Z',
          },
          { artefact_id: 'a2', stability: null, next_due_at: '2026-07-26T00:00:00.000Z', last_reviewed_at: null },
        ],
        error: null,
      },
    })

    const plan = await examPlanFor(supabase, { subjectId: 's1', now: NOW })

    expect(plan.subjectId).toBe('s1')
    expect(plan.examDate).toBe('2026-07-28')
    expect(plan.days.map((day) => day.date)).toEqual(['2026-07-26', '2026-07-27', '2026-07-28'])
    expect(plan.days.reduce((sum, day) => sum + day.count, 0)).toBe(2)
  })

  it('scopes the schedule read to the course', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 's1', title: 'Optics', exam_date: '2026-07-28' }, error: null },
      artefact_schedule: { data: [], error: null },
    })

    await examPlanFor(supabase, { subjectId: 's1', now: NOW })

    expect(argsOf(supabase.query('artefact_schedule'), 'eq')).toEqual(['subject_id', 's1'])
  })
})
