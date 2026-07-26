// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'

const { listConceptMastery } = vi.hoisted(() => ({ listConceptMastery: vi.fn() }))
vi.mock('./concepts.js', () => ({ listConceptMastery }))

import { examPassInputs } from './prediction.js'

const NOW = new Date('2026-07-25T12:00:00.000Z')

describe('examPassInputs', () => {
  it('gathers the concepts a course has, unfiltered by anything else', async () => {
    listConceptMastery.mockResolvedValue([{ id: 'c1', mastery: 0.4 }])
    const supabase = fakeSupabase({
      artefact_schedule: { data: [], error: null },
      reviews: { data: [], error: null },
    })

    const inputs = await examPassInputs(supabase, { subjectId: 'subject-1', now: NOW })

    expect(inputs.concepts).toEqual([{ id: 'c1', mastery: 0.4 }])
    expect(listConceptMastery).toHaveBeenCalledWith(supabase, { subjectId: 'subject-1' })
  })

  it('is not overdue at all when the queue is empty', async () => {
    listConceptMastery.mockResolvedValue([])
    const supabase = fakeSupabase({ artefact_schedule: { data: [], error: null } })

    const inputs = await examPassInputs(supabase, { subjectId: 'subject-1', now: NOW })

    expect(inputs.overdueFraction).toBe(0)
    expect(inputs.reviewsPerDay).toBe(0)
  })

  it('counts the share of the queue that fell due before today', async () => {
    listConceptMastery.mockResolvedValue([])
    const supabase = fakeSupabase({
      artefact_schedule: {
        data: [
          { artefact_id: 'a1', next_due_at: '2026-07-20T00:00:00.000Z' }, // overdue
          { artefact_id: 'a2', next_due_at: '2026-07-25T18:00:00.000Z' }, // due later today
          { artefact_id: 'a3', next_due_at: '2026-08-01T00:00:00.000Z' }, // not due yet
          { artefact_id: 'a4', next_due_at: '2026-07-24T23:00:00.000Z' }, // overdue
        ],
        error: null,
      },
      reviews: { data: [], error: null },
    })

    const inputs = await examPassInputs(supabase, { subjectId: 'subject-1', now: NOW })

    expect(inputs.overdueFraction).toBeCloseTo(0.5, 6)
  })

  it('reads recent review velocity over the artefacts this course actually has', async () => {
    listConceptMastery.mockResolvedValue([])
    const supabase = fakeSupabase({
      artefact_schedule: {
        data: [{ artefact_id: 'a1', next_due_at: '2026-08-01T00:00:00.000Z' }],
        error: null,
      },
      reviews: {
        data: [
          { id: 'r1', reviewed_at: '2026-07-24T00:00:00.000Z' },
          { id: 'r2', reviewed_at: '2026-07-23T00:00:00.000Z' },
        ],
        error: null,
      },
    })

    const inputs = await examPassInputs(supabase, { subjectId: 'subject-1', now: NOW })

    expect(argsOf(supabase.query('reviews'), 'in')).toEqual(['artefact_id', ['a1']])
    expect(inputs.reviewsPerDay).toBeCloseTo(2 / 14, 6)
  })
})
