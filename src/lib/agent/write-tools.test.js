import { describe, expect, it, vi } from 'vitest'

import { argsOf, fakeSupabase, methodsOf } from '../data/fake-supabase.js'
import { WRITE_TOOLS, applyUndo, makeArtefacts, renameCourse } from './write-tools.js'

describe('renameCourse', () => {
  it('records the old name, because an action without its inverse is only a log', async () => {
    const supabase = fakeSupabase({
      subjects: [
        { data: { id: 'sub1', title: 'Probabilty' }, error: null },
        { data: { id: 'sub1', title: 'Probability' }, error: null },
      ],
    })
    const record = vi.fn()

    await renameCourse(supabase, {
      userId: 'u1',
      runId: 'r1',
      courseId: 'sub1',
      title: 'Probability',
      record,
    })

    expect(record.mock.calls[0][1]).toMatchObject({
      tool: 'rename_course',
      undo: { kind: 'restore_course_title', courseId: 'sub1', title: 'Probabilty' },
    })
  })

  it('reads before it writes, so the previous state still exists to capture', async () => {
    const supabase = fakeSupabase({
      subjects: [
        { data: { id: 'sub1', title: 'old' }, error: null },
        { data: { id: 'sub1', title: 'new' }, error: null },
      ],
    })

    await renameCourse(supabase, {
      userId: 'u1',
      runId: 'r1',
      courseId: 'sub1',
      title: 'new',
      record: vi.fn(),
    })

    const [first, second] = supabase.queries('subjects');
    expect(methodsOf(first)).toContain('select')
    expect(methodsOf(first)).not.toContain('update')
    expect(methodsOf(second)).toContain('update')
  })

  it('refuses to blank a course name', async () => {
    const supabase = fakeSupabase()

    await expect(
      renameCourse(supabase, { courseId: 'sub1', title: '  ', record: vi.fn() }),
    ).rejects.toThrow(/name/i)
  })

  it('says so when the course is not the learner’s', async () => {
    const supabase = fakeSupabase({ subjects: { data: null, error: null } })

    await expect(
      renameCourse(supabase, { courseId: 'nope', title: 'x', record: vi.fn() }),
    ).rejects.toThrow(/not found/i)
  })
})

describe('makeArtefacts', () => {
  const passage = {
    data: {
      id: 's1',
      ordinal: 1,
      content: 'A martingale is a fair game.',
      anchor: { page: 4 },
      sources: { id: 'src1', title: 'Probability', subject_id: 'sub1' },
    },
    error: null,
  }

  function supabaseFor() {
    return fakeSupabase({
      sections: passage,
      artefacts: { data: [{ id: 'a1', format: 'flashcard' }], error: null },
    })
  }

  const client = {
    chatStructured: async () => ({ front: 'What is a martingale?', back: 'A fair game.' }),
  }

  it('records the ids it made, so the insert can be retracted', async () => {
    const record = vi.fn()

    await makeArtefacts(supabaseFor(), {
      userId: 'u1',
      runId: 'r1',
      sectionId: 's1',
      format: 'flashcard',
      count: 1,
      client,
      record,
    })

    expect(record.mock.calls[0][1]).toMatchObject({
      tool: 'make_artefacts',
      undo: { kind: 'remove_artefacts', ids: ['a1'] },
    })
  })

  it('bounds what one call can spend', async () => {
    const chatStructured = vi.fn(async () => ({ front: 'q', back: 'a' }))

    await makeArtefacts(supabaseFor(), {
      userId: 'u1',
      runId: 'r1',
      sectionId: 's1',
      format: 'flashcard',
      count: 99,
      client: { chatStructured },
      record: vi.fn(),
    })

    expect(chatStructured.mock.calls.length).toBeLessThanOrEqual(6)
  })

  it('carries the anchor back, like every other tool', async () => {
    const result = await makeArtefacts(supabaseFor(), {
      userId: 'u1',
      runId: 'r1',
      sectionId: 's1',
      format: 'flashcard',
      count: 1,
      client,
      record: vi.fn(),
    })

    expect(result).toMatchObject({ section_id: 's1', anchor: { page: 4 } })
  })
})

describe('applyUndo', () => {
  it('puts a course name back', async () => {
    const supabase = fakeSupabase({ subjects: { data: { id: 'sub1' }, error: null } })

    await applyUndo(supabase, {
      undo: { kind: 'restore_course_title', courseId: 'sub1', title: 'old' },
    })

    expect(argsOf(supabase.query('subjects'), 'update')[0]).toEqual({ title: 'old' })
  })

  it('retracts artefacts the agent inserted', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [{ id: 'a1' }], error: null } })

    await applyUndo(supabase, { undo: { kind: 'remove_artefacts', ids: ['a1', 'a2'] } })

    const call = supabase.query('artefacts')
    expect(methodsOf(call)).toContain('delete')
    expect(argsOf(call, 'in')).toEqual(['id', ['a1', 'a2']])
  })

  it('refuses an action it does not know how to reverse', async () => {
    await expect(
      applyUndo(fakeSupabase(), { undo: { kind: 'drop_database' } }),
    ).rejects.toThrow(/cannot be undone/i)
  })
})

describe('WRITE_TOOLS', () => {
  it('destroys nothing the learner brought', () => {
    expect(WRITE_TOOLS.map((definition) => definition.name).sort()).toEqual([
      'make_artefacts',
      'rename_course',
    ])
  })

  it('tells the learner, through the model, that a rename can be taken back', () => {
    const rename = WRITE_TOOLS.find((definition) => definition.name === 'rename_course')
    expect(rename.description).toMatch(/undo/i)
  })
})
