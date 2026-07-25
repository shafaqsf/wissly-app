import { describe, expect, it } from 'vitest'

import { fakeSupabase } from '../data/fake-supabase.js'
import { describeUndo, undoRun } from './undo.js'

function supabaseWith(actions, { claim = true } = {}) {
  return fakeSupabase({
    agent_actions: [
      { data: actions, error: null },
      ...actions.flatMap(() => [{ data: claim ? { id: 'claimed' } : null, error: null }]),
    ],
    subjects: { data: { id: 'sub1' }, error: null },
    artefacts: { data: [{ id: 'a1' }], error: null },
  })
}

const rename = (id, title) => ({
  id,
  tool: 'rename_course',
  undo: { kind: 'restore_course_title', courseId: 'sub1', title },
  undone_at: null,
})

describe('undoRun', () => {
  it('replays the inverses newest first, so the original state comes back', async () => {
    const applied = []
    const supabase = supabaseWith([rename('x1', 'first'), rename('x2', 'second')])

    // Two renames of one course: walking forwards would leave the middle name.
    await undoRun(supabase, { runId: 'r1' })

    const titles = supabase
      .queries('subjects')
      .map((call) => call.chain.find((step) => step.method === 'update')?.args[0].title)
      .filter(Boolean)

    applied.push(...titles)
    expect(applied).toEqual(['second', 'first'])
  })

  it('skips what was already taken back', async () => {
    const supabase = supabaseWith([
      { ...rename('x1', 'first'), undone_at: '2026-07-25T10:00:00Z' },
    ])

    expect(await undoRun(supabase, { runId: 'r1' })).toEqual({ undone: [], failed: [] })
  })

  it('skips a read, because there is nothing to reverse', async () => {
    const supabase = supabaseWith([{ id: 'x1', tool: 'search_sections', undo: null }])

    expect(await undoRun(supabase, { runId: 'r1' })).toEqual({ undone: [], failed: [] })
  })

  it('does nothing twice when two clicks race for the same action', async () => {
    const supabase = supabaseWith([rename('x1', 'first')], { claim: false })

    const result = await undoRun(supabase, { runId: 'r1' })

    expect(result.undone).toEqual([])
    expect(supabase.queries('subjects')).toHaveLength(0)
  })

  it('reports what it could not take back rather than claiming it did', async () => {
    const supabase = supabaseWith([
      { id: 'x1', tool: 'mystery', undo: { kind: 'drop_database' }, undone_at: null },
    ])

    const result = await undoRun(supabase, { runId: 'r1' })

    expect(result.undone).toEqual([])
    expect(result.failed[0]).toMatchObject({ tool: 'mystery' })
  })
})

describe('describeUndo', () => {
  it('counts in the learner’s terms', () => {
    expect(describeUndo({ undone: ['rename_course'], failed: [] })).toBe(
      'Took back 1 change.',
    )
    expect(describeUndo({ undone: ['a', 'b'], failed: [] })).toBe('Took back 2 changes.')
  })

  it('says plainly when there was nothing to do', () => {
    expect(describeUndo({ undone: [], failed: [] })).toMatch(/nothing to take back/i)
  })

  it('names a failure instead of hiding it behind a success', () => {
    const text = describeUndo({
      undone: ['a'],
      failed: [{ tool: 'b', reason: 'That action cannot be undone.' }],
    })

    expect(text).toMatch(/Took back 1 change/)
    expect(text).toMatch(/could not be taken back/)
  })
})
