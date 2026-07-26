// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import { dueArtefacts, dueScheduleItems, fsrsState, recordReview } from './review.js'

const NOW = new Date('2026-07-25T09:00:00.000Z')

describe('the FSRS state on a schedule row', () => {
  it('is null for an artefact nobody has answered yet', () => {
    expect(fsrsState({ artefact_id: 'a1', stability: null })).toBeNull()
    expect(fsrsState(null)).toBeNull()
  })

  it('comes back as numbers, not as the strings Postgres sends', () => {
    const state = fsrsState({
      stability: '4.5',
      difficulty: '5.1',
      reps: '3',
      lapses: '1',
      due_at: '2026-07-30T09:00:00.000Z',
      last_reviewed_at: '2026-07-25T09:00:00.000Z',
    })

    expect(state).toEqual({
      stability: 4.5,
      difficulty: 5.1,
      reps: 3,
      lapses: 1,
      due_at: '2026-07-30T09:00:00.000Z',
      last_reviewed_at: '2026-07-25T09:00:00.000Z',
    })
  })
})

describe('the queue', () => {
  it('asks for what is due now, oldest first, and no more than a sitting', async () => {
    const supabase = fakeSupabase({ artefact_schedule: { data: [], error: null } })

    await dueArtefacts(supabase, { now: NOW })

    const call = supabase.query('artefact_schedule')
    expect(argsOf(call, 'lte')).toEqual(['next_due_at', NOW.toISOString()])
    expect(argsOf(call, 'order')).toEqual(['next_due_at', { ascending: true }])
    expect(argsOf(call, 'limit')?.[0]).toBeLessThanOrEqual(30)
  })

  it('gives each artefact the id the renderers use and the state the scheduler needs', async () => {
    const supabase = fakeSupabase({
      artefact_schedule: {
        data: [
          {
            artefact_id: 'a1',
            section_id: 'sec-1',
            format: 'flashcard',
            payload: { front: 'F', back: 'B' },
            stability: '4.5',
            difficulty: '5.1',
            reps: '2',
            lapses: '0',
            due_at: '2026-07-25T08:00:00.000Z',
            last_reviewed_at: '2026-07-20T08:00:00.000Z',
          },
        ],
        error: null,
      },
      sections: {
        data: [{ id: 'sec-1', ordinal: 4, content: 'Light bends.', anchor: { page: 12 } }],
        error: null,
      },
    })

    const [artefact] = await dueArtefacts(supabase, { now: NOW })

    expect(artefact.id).toBe('a1')
    expect(artefact.passage).toBe('Light bends.')
    expect(artefact.section_ordinal).toBe(4)
    expect(artefact.state.stability).toBe(4.5)
  })

  it('carries no state for material that has never been answered', async () => {
    const supabase = fakeSupabase({
      artefact_schedule: {
        data: [{ artefact_id: 'a1', format: 'cloze', payload: {}, section_id: null, stability: null }],
        error: null,
      },
    })

    const [artefact] = await dueArtefacts(supabase, { now: NOW })

    expect(artefact.state).toBeNull()
  })
})

describe('the due schedule, lean, for the reminder to reason about', () => {
  it('asks for what is due now, without pulling in section content', async () => {
    const supabase = fakeSupabase({ artefact_schedule: { data: [], error: null } })

    await dueScheduleItems(supabase, { now: NOW })

    const call = supabase.query('artefact_schedule')
    expect(argsOf(call, 'lte')).toEqual(['next_due_at', NOW.toISOString()])
    expect(argsOf(call, 'select')?.[0]).not.toMatch(/payload/)
  })

  it('shapes each row for the reminder decision, numbers coerced', async () => {
    const supabase = fakeSupabase({
      artefact_schedule: {
        data: [
          {
            artefact_id: 'a1',
            stability: '4.5',
            due_at: '2026-07-20T09:00:00.000Z',
            last_reviewed_at: '2026-07-15T09:00:00.000Z',
          },
          { artefact_id: 'a2', stability: null, due_at: null, last_reviewed_at: null },
        ],
        error: null,
      },
    })

    const items = await dueScheduleItems(supabase, { now: NOW })

    expect(items).toEqual([
      {
        artefactId: 'a1',
        stability: 4.5,
        dueAt: '2026-07-20T09:00:00.000Z',
        lastReviewedAt: '2026-07-15T09:00:00.000Z',
      },
      { artefactId: 'a2', stability: null, dueAt: null, lastReviewedAt: null },
    ])
  })
})

describe('recording a rating', () => {
  it('appends a row rather than overwriting the last one', async () => {
    const supabase = fakeSupabase({
      reviews: { data: { id: 'r1' }, error: null },
    })

    await recordReview(supabase, {
      userId: 'user-1',
      artefactId: 'a1',
      rating: 3,
      state: null,
      now: NOW,
    })

    const [row] = argsOf(supabase.query('reviews'), 'insert')
    expect(row).toMatchObject({ user_id: 'user-1', artefact_id: 'a1', rating: 3 })
    expect(row.reviewed_at).toBe(NOW.toISOString())
  })

  it('writes the date the scheduler chose, not one of its own', async () => {
    const supabase = fakeSupabase({ reviews: { data: { id: 'r1' }, error: null } })

    await recordReview(supabase, {
      userId: 'user-1',
      artefactId: 'a1',
      rating: 4,
      state: null,
      now: NOW,
    })

    const [row] = argsOf(supabase.query('reviews'), 'insert')
    expect(new Date(row.due_at).getTime()).toBeGreaterThan(NOW.getTime())
    expect(row.stability).toBeGreaterThan(0)
    expect(row.reps).toBe(1)
  })

  it('counts a failure as a lapse when there was something to lose', async () => {
    const supabase = fakeSupabase({ reviews: { data: { id: 'r1' }, error: null } })

    await recordReview(supabase, {
      userId: 'user-1',
      artefactId: 'a1',
      rating: 1,
      state: {
        stability: 10,
        difficulty: 5,
        reps: 3,
        lapses: 0,
        due_at: '2026-07-24T09:00:00.000Z',
        last_reviewed_at: '2026-07-18T09:00:00.000Z',
      },
      now: NOW,
    })

    const [row] = argsOf(supabase.query('reviews'), 'insert')
    expect(row.lapses).toBe(1)
    expect(row.reps).toBe(4)
  })

  it('refuses a rating that is not one of the four buttons', async () => {
    const supabase = fakeSupabase()

    await expect(
      recordReview(supabase, { userId: 'user-1', artefactId: 'a1', rating: 7, now: NOW }),
    ).rejects.toThrow(/four buttons/)
    expect(supabase.calls).toHaveLength(0)
  })
})
