// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  autonomousActions,
  dueCounts,
  effortByDay,
  gapConcepts,
  reviewsByDay,
  runCost,
} from './agent-runs.js'
import { argsOf, argsOfAll, fakeSupabase } from './fake-supabase.js'

const NOW = new Date('2026-07-25T12:00:00.000Z')

describe('runCost', () => {
  it('takes the price OpenRouter already worked out', () => {
    expect(runCost({ model: 'anthropic/claude-sonnet-5', usage: { cost: 0.42 } })).toBe(0.42)
  })

  it('prices the tokens itself when the run carries none', () => {
    const cost = runCost({
      model: 'anthropic/claude-sonnet-5',
      usage: { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 },
    })

    expect(cost).toBeCloseTo(12, 6)
  })

  it('is zero for a model nobody has a price for', () => {
    expect(runCost({ model: 'someone/unknown', usage: { prompt_tokens: 500 } })).toBe(0)
  })

  it('is zero for a run that never reported its usage', () => {
    expect(runCost({ model: 'anthropic/claude-sonnet-5', usage: null })).toBe(0)
  })
})

describe('autonomousActions', () => {
  it('reads only the runs nobody asked for', async () => {
    const supabase = fakeSupabase({
      agent_runs: { data: [{ id: 'run-1' }], error: null },
      agent_actions: { data: [], error: null },
    })

    await autonomousActions(supabase, { limit: 5 })

    expect(argsOf(supabase.query('agent_runs'), 'eq')).toEqual(['trigger', 'schedule'])
  })

  it('leaves out what has already been taken back', async () => {
    const supabase = fakeSupabase({
      agent_runs: { data: [{ id: 'run-1' }], error: null },
      agent_actions: {
        data: [
          {
            id: 'act-1',
            run_id: 'run-1',
            tool: 'generate_flashcards',
            arguments: { count: 4 },
            result: null,
            undo: {},
            undone_at: null,
            created_at: '2026-07-25T09:00:00.000Z',
          },
        ],
        error: null,
      },
    })

    const actions = await autonomousActions(supabase, { limit: 5 })

    expect(argsOf(supabase.query('agent_actions'), 'is')).toEqual(['undone_at', null])
    expect(argsOf(supabase.query('agent_actions'), 'in')).toEqual(['run_id', ['run-1']])
    expect(actions).toEqual([
      {
        id: 'act-1',
        runId: 'run-1',
        tool: 'generate_flashcards',
        args: { count: 4 },
        result: null,
        createdAt: '2026-07-25T09:00:00.000Z',
      },
    ])
  })

  it('asks for no actions at all when the agent has never run alone', async () => {
    const supabase = fakeSupabase({ agent_runs: { data: [], error: null } })

    expect(await autonomousActions(supabase)).toEqual([])
    expect(supabase.query('agent_actions')).toBeUndefined()
  })
})

describe('effortByDay', () => {
  it('returns one bucket per day, oldest first, ending today', async () => {
    const supabase = fakeSupabase({ agent_runs: { data: [], error: null } })

    const days = await effortByDay(supabase, { days: 7, now: NOW })

    expect(days).toHaveLength(7)
    expect(days[0].date).toBe('2026-07-19')
    expect(days[6].date).toBe('2026-07-25')
    expect(days.every((day) => day.calls === 0 && day.cost === 0)).toBe(true)
  })

  it('counts the calls and adds up the cost, split by who asked', async () => {
    const supabase = fakeSupabase({
      agent_runs: {
        data: [
          {
            id: 'a',
            trigger: 'user',
            model: 'anthropic/claude-sonnet-5',
            usage: { cost: 0.5 },
            started_at: '2026-07-25T08:00:00.000Z',
          },
          {
            id: 'b',
            trigger: 'schedule',
            model: 'anthropic/claude-sonnet-5',
            usage: { cost: 0.25 },
            started_at: '2026-07-25T09:00:00.000Z',
          },
          {
            id: 'c',
            trigger: 'user',
            model: 'anthropic/claude-sonnet-5',
            usage: { cost: 1 },
            started_at: '2026-07-24T09:00:00.000Z',
          },
        ],
        error: null,
      },
    })

    const days = await effortByDay(supabase, { days: 7, now: NOW })
    const today = days.at(-1)

    expect(today).toEqual({
      date: '2026-07-25',
      calls: 2,
      cost: 0.75,
      byCause: { user: 0.5, schedule: 0.25 },
    })
    expect(days.at(-2).calls).toBe(1)
  })

  it('never reads further back than the window', async () => {
    const supabase = fakeSupabase({ agent_runs: { data: [], error: null } })

    await effortByDay(supabase, { days: 7, now: NOW })

    expect(argsOf(supabase.query('agent_runs'), 'gte')).toEqual([
      'started_at',
      '2026-07-19T00:00:00.000Z',
    ])
  })
})

describe('reviewsByDay', () => {
  it('counts the reviews of each day in the window', async () => {
    const supabase = fakeSupabase({
      reviews: {
        data: [
          { id: 'r1', reviewed_at: '2026-07-25T06:00:00.000Z' },
          { id: 'r2', reviewed_at: '2026-07-25T07:00:00.000Z' },
          { id: 'r3', reviewed_at: '2026-07-20T07:00:00.000Z' },
        ],
        error: null,
      },
    })

    const days = await reviewsByDay(supabase, { days: 7, now: NOW })

    expect(days).toHaveLength(7)
    expect(days.at(-1)).toEqual({ date: '2026-07-25', reviews: 2 })
    expect(days[1]).toEqual({ date: '2026-07-20', reviews: 1 })
  })
})

describe('gapConcepts', () => {
  const concepts = {
    data: [
      { id: 'c1', subject_id: 's1', term: 'Cauchy sequence', section_id: 'sec-1' },
      { id: 'c2', subject_id: 's1', term: 'Compactness', section_id: 'sec-2' },
      { id: 'c3', subject_id: 's1', term: 'Never touched', section_id: null },
    ],
    error: null,
  }

  const mastery = {
    data: [
      { concept_id: 'c1', mastery: 0.2 },
      { concept_id: 'c2', mastery: 0.95 },
    ],
    error: null,
  }

  function supabaseWith() {
    return fakeSupabase({
      concepts: [concepts, concepts],
      concept_mastery: mastery,
      sections: {
        data: [
          { id: 'sec-1', source_id: 'src-1', ordinal: 3 },
          { id: 'sec-2', source_id: 'src-1', ordinal: 4 },
        ],
        error: null,
      },
      sources: { data: [{ id: 'src-1', title: 'Rudin, chapter 3' }], error: null },
    })
  }

  it('names only what has been attempted and still does not hold', async () => {
    const gaps = await gapConcepts(supabaseWith(), { subjectId: 's1' })

    expect(gaps.map((gap) => gap.name)).toEqual(['Cauchy sequence'])
  })

  it('carries the source the gap came from, so it can be linked', async () => {
    const gaps = await gapConcepts(supabaseWith(), { subjectId: 's1' })

    expect(gaps[0]).toMatchObject({
      id: 'c1',
      subjectId: 's1',
      mastery: 0.2,
      sectionOrdinal: 3,
      source: { id: 'src-1', title: 'Rudin, chapter 3' },
    })
  })

  it('puts the weakest first', async () => {
    const supabase = fakeSupabase({
      concepts: [concepts, concepts],
      concept_mastery: {
        data: [
          { concept_id: 'c1', mastery: 0.6 },
          { concept_id: 'c2', mastery: 0.1 },
        ],
        error: null,
      },
      sections: { data: [], error: null },
      sources: { data: [], error: null },
    })

    const gaps = await gapConcepts(supabase, { subjectId: 's1' })

    expect(gaps.map((gap) => gap.name)).toEqual(['Compactness', 'Cauchy sequence'])
  })

  it('reads no sections when nothing is a gap', async () => {
    const supabase = fakeSupabase({
      concepts: [concepts, concepts],
      concept_mastery: { data: [], error: null },
    })

    expect(await gapConcepts(supabase, { subjectId: 's1' })).toEqual([])
    expect(supabase.query('sections')).toBeUndefined()
  })

  it('scopes both concept reads to the course it was given', async () => {
    const supabase = supabaseWith()

    await gapConcepts(supabase, { subjectId: 's1' })

    expect(argsOfAll(supabase.query('concepts'), 'eq')).toContainEqual(['subject_id', 's1'])
  })
})

describe('dueCounts', () => {
  it('separates what is due today from what is already late', async () => {
    const supabase = fakeSupabase({
      artefact_schedule: {
        data: [
          { artefact_id: 'a', next_due_at: '2026-07-25T06:00:00.000Z' },
          { artefact_id: 'b', next_due_at: '2026-07-23T06:00:00.000Z' },
          { artefact_id: 'c', next_due_at: '2026-07-22T06:00:00.000Z' },
        ],
        error: null,
      },
    })

    expect(await dueCounts(supabase, { now: NOW })).toEqual({ due: 3, overdue: 2 })
  })

  it('asks only for what is due by now', async () => {
    const supabase = fakeSupabase({ artefact_schedule: { data: [], error: null } })

    await dueCounts(supabase, { now: NOW })

    expect(argsOf(supabase.query('artefact_schedule'), 'lte')).toEqual([
      'next_due_at',
      NOW.toISOString(),
    ])
  })
})
