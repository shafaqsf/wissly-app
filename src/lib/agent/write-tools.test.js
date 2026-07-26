// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { argsOf, argsOfAll, fakeSupabase, methodsOf } from '../data/fake-supabase.js'
import {
  WRITE_TOOLS,
  addMaterialTool,
  applyUndo,
  archiveSourceTool,
  archiveTasks,
  buildCourseFromGoal,
  createCourseTool,
  editArtefact,
  makeArtefacts,
  moveTasks,
  recordReviewTool,
  renameCourse,
  rescheduleTasks,
  showInInterface,
  writeArtefact,
} from './write-tools.js'

const run = { userId: 'u1', runId: 'r1' }

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
      ...run,
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

    await renameCourse(supabase, { ...run, courseId: 'sub1', title: 'new', record: vi.fn() })

    const [first, second] = supabase.queries('subjects')
    expect(methodsOf(first)).toContain('select')
    expect(methodsOf(first)).not.toContain('update')
    expect(methodsOf(second)).toContain('update')
  })

  it('refuses to blank a course name', async () => {
    await expect(
      renameCourse(fakeSupabase(), { ...run, courseId: 'sub1', title: '  ', record: vi.fn() }),
    ).rejects.toThrow(/name/i)
  })

  it('says so when the course is not the learner’s', async () => {
    const supabase = fakeSupabase({ subjects: { data: null, error: null } })

    await expect(
      renameCourse(supabase, { ...run, courseId: 'nope', title: 'x', record: vi.fn() }),
    ).rejects.toThrow(/not found/i)
  })
})

describe('createCourseTool', () => {
  it('makes a course and records how to retract it', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 'sub9', title: 'Optics' }, error: null },
    })
    const record = vi.fn()

    const result = await createCourseTool(supabase, { ...run, title: 'Optics', record })

    expect(result).toMatchObject({ course_id: 'sub9', title: 'Optics' })
    expect(record.mock.calls[0][1]).toMatchObject({
      tool: 'create_course',
      undo: { kind: 'remove_course', courseId: 'sub9' },
    })
  })
})

describe('addMaterialTool', () => {
  it('files the material and makes no model call doing it', async () => {
    const addMaterial = vi.fn(async () => ({
      subject: { id: 'sub1', title: 'Optics' },
      source: { id: 'src1', title: 'Lecture 1' },
      sections: [{ id: 's1' }, { id: 's2' }],
      concepts: [{ id: 'k1' }],
    }))
    const record = vi.fn()

    const result = await addMaterialTool(fakeSupabase(), {
      ...run,
      course: 'Optics',
      title: 'Lecture 1',
      text: 'A martingale is a fair game.',
      addMaterial,
      record,
    })

    expect(addMaterial.mock.calls[0][0]).not.toHaveProperty('client')
    expect(result).toMatchObject({ source_id: 'src1', sections: 2 })
    // Nothing was generated. Generating is a thing the learner asks for.
    expect(result).not.toHaveProperty('artefacts')
  })

  it('undoes by archiving the source, never by deleting the learner’s material', async () => {
    const record = vi.fn()

    await addMaterialTool(fakeSupabase(), {
      ...run,
      course: 'Optics',
      title: 'Lecture 1',
      text: 'x',
      addMaterial: async () => ({
        subject: { id: 'sub1' },
        source: { id: 'src1' },
        sections: [{ id: 's1' }],
        concepts: [],
      }),
      record,
    })

    expect(record.mock.calls[0][1].undo).toEqual({ kind: 'archive_source', sourceId: 'src1' })
  })
})

describe('buildCourseFromGoal', () => {
  const outline = {
    title: 'Eigenvalues for the exam',
    sections: [
      { heading: 'What an eigenvector is', content: 'An eigenvector of A is a nonzero v with Av = λv.' },
      { heading: 'Finding eigenvalues', content: 'Solve det(A - λI) = 0.' },
    ],
  }

  function scriptedClient() {
    let call = 0
    const answers = [
      outline,
      { format: 'flashcard', reason: 'r' },
      { front: 'q1', back: 'a1' },
      { format: 'flashcard', reason: 'r' },
      { front: 'q2', back: 'a2' },
    ]
    return { chatStructured: vi.fn(async () => answers[call++]), chat: vi.fn() }
  }

  function supabaseFor() {
    return fakeSupabase({
      subjects: { data: { id: 'sub1', title: 'Eigenvalues for the exam' }, error: null },
      sources: { data: { id: 'src1', title: 'Eigenvalues for the exam' }, error: null },
      sections: {
        data: [
          { id: 'sec1', ordinal: 1 },
          { id: 'sec2', ordinal: 2 },
        ],
        error: null,
      },
      concepts: { data: [{ id: 'con1' }, { id: 'con2' }], error: null },
      artefacts: {
        data: [
          { id: 'a1', format: 'flashcard' },
          { id: 'a2', format: 'flashcard' },
        ],
        error: null,
      },
    })
  }

  it('drafts a course, sections, concepts and a first batch of artefacts, all honestly generated', async () => {
    const record = vi.fn()

    const result = await buildCourseFromGoal(supabaseFor(), {
      ...run,
      goal: 'I want to understand eigenvalues for my exam',
      client: scriptedClient(),
      record,
    })

    expect(result).toMatchObject({
      course_id: 'sub1',
      source_id: 'src1',
      sections: 2,
      concepts: 2,
      artefacts: 2,
      generated: true,
    })
  })

  it('marks the source generated, never pretending it was uploaded', async () => {
    const supabase = supabaseFor()

    await buildCourseFromGoal(supabase, {
      ...run,
      goal: 'eigenvalues',
      client: scriptedClient(),
      record: vi.fn(),
    })

    const [insert] = argsOf(supabase.query('sources'), 'insert')
    expect(insert.generated).toBe(true)
  })

  it('undoes by archiving the generated source, never by deleting the learner’s course', async () => {
    const record = vi.fn()

    await buildCourseFromGoal(supabaseFor(), {
      ...run,
      goal: 'eigenvalues',
      client: scriptedClient(),
      record,
    })

    expect(record.mock.calls[0][1]).toMatchObject({
      tool: 'build_course_from_goal',
      undo: { kind: 'archive_source', sourceId: 'src1' },
    })
  })

  it('refuses an empty goal without spending a call', async () => {
    await expect(
      buildCourseFromGoal(supabaseFor(), {
        ...run,
        goal: '   ',
        client: scriptedClient(),
        record: vi.fn(),
      }),
    ).rejects.toThrow(/say what you want to learn/i)
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
      ...run,
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
      ...run,
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
      ...run,
      sectionId: 's1',
      format: 'flashcard',
      count: 1,
      client,
      record: vi.fn(),
    })

    expect(result).toMatchObject({ section_id: 's1', anchor: { page: 4 } })
  })

  it('writes reading as readily as it writes tasks', async () => {
    const supabase = fakeSupabase({
      sections: passage,
      artefacts: { data: [{ id: 'a1', format: 'summary' }], error: null },
    })

    const result = await makeArtefacts(supabase, {
      ...run,
      sectionId: 's1',
      format: 'summary',
      count: 1,
      client: {
        chatStructured: async () => ({
          three_sentences: ['a.', 'b.', 'c.'],
          paragraph: 'p',
          full: 'f',
        }),
      },
      record: vi.fn(),
    })

    expect(result.formats).toEqual(['summary'])
  })
})

describe('writeArtefact', () => {
  it('writes one by hand, costing nothing, marked as the agent’s', async () => {
    const supabase = fakeSupabase({
      artefacts: { data: { id: 'a1', format: 'flashcard' }, error: null },
    })
    const record = vi.fn()

    await writeArtefact(supabase, {
      ...run,
      subjectId: 'sub1',
      sectionId: 's1',
      format: 'flashcard',
      payload: { front: 'q', back: 'a' },
      record,
    })

    expect(argsOf(supabase.query('artefacts'), 'insert')[0]).toMatchObject({ origin: 'agent' })
    expect(record.mock.calls[0][1].undo).toEqual({ kind: 'remove_artefacts', ids: ['a1'] })
  })

  it('refuses a payload its format would not render', async () => {
    await expect(
      writeArtefact(fakeSupabase(), {
        ...run,
        format: 'cloze',
        payload: { text: 'no blank here', answer: 'x' },
        record: vi.fn(),
      }),
    ).rejects.toThrow(/blank/i)
  })
})

describe('editArtefact', () => {
  it('keeps the payload it replaced', async () => {
    const supabase = fakeSupabase({
      artefacts: [
        { data: { id: 'a1', format: 'flashcard', payload: { front: 'old', back: 'a' } }, error: null },
        { data: { id: 'a1', format: 'flashcard', payload: { front: 'new', back: 'a' } }, error: null },
      ],
    })
    const record = vi.fn()

    await editArtefact(supabase, {
      ...run,
      artefactId: 'a1',
      payload: { front: 'new', back: 'a' },
      record,
    })

    expect(record.mock.calls[0][1].undo).toEqual({
      kind: 'restore_artefact',
      artefactId: 'a1',
      payload: { front: 'old', back: 'a' },
    })
  })
})

describe('moveTasks', () => {
  it('remembers where each one came from, not just that they moved', async () => {
    const supabase = fakeSupabase({
      artefacts: [
        {
          data: [
            { id: 'a1', subject_id: 'subA' },
            { id: 'a2', subject_id: 'subB' },
          ],
          error: null,
        },
        {
          data: [
            { id: 'a1', subject_id: 'subC' },
            { id: 'a2', subject_id: 'subC' },
          ],
          error: null,
        },
      ],
    })
    const record = vi.fn()

    await moveTasks(supabase, { ...run, ids: ['a1', 'a2'], subjectId: 'subC', record })

    expect(record.mock.calls[0][1].undo).toEqual({
      kind: 'move_artefacts_back',
      previous: { subA: ['a1'], subB: ['a2'] },
    })
  })
})

describe('archiveTasks', () => {
  it('archives rather than deletes, and can be put back', async () => {
    const supabase = fakeSupabase({
      artefacts: { data: [{ id: 'a1' }, { id: 'a2' }], error: null },
    })
    const record = vi.fn()

    await archiveTasks(supabase, { ...run, ids: ['a1', 'a2'], record })

    const call = supabase.query('artefacts')
    expect(methodsOf(call)).not.toContain('delete')
    expect(argsOf(call, 'update')[0]).toHaveProperty('archived_at')
    expect(record.mock.calls[0][1].undo).toEqual({
      kind: 'restore_artefacts',
      ids: ['a1', 'a2'],
    })
  })
})

describe('archiveSourceTool', () => {
  it('is soft, like every destruction the agent can reach', async () => {
    const supabase = fakeSupabase({
      sources: { data: { id: 'src1', title: 'Lecture 1' }, error: null },
    })
    const record = vi.fn()

    await archiveSourceTool(supabase, { ...run, sourceId: 'src1', record })

    expect(methodsOf(supabase.query('sources'))).not.toContain('delete')
    expect(record.mock.calls[0][1].undo).toEqual({ kind: 'restore_source', sourceId: 'src1' })
  })
})

describe('rescheduleTasks', () => {
  it('remembers each previous due date, grouped so the inverse is one write each', async () => {
    const supabase = fakeSupabase({
      artefact_schedule: [
        { data: { artefact_id: 'a1', due_at: '2026-07-01T00:00:00.000Z' }, error: null },
        { data: { artefact_id: 'a2', due_at: '2026-07-01T00:00:00.000Z' }, error: null },
      ],
      reviews: [
        { data: [{ id: 'rev1', artefact_id: 'a1' }, { id: 'rev2', artefact_id: 'a2' }], error: null },
        { data: [{ id: 'rev1', artefact_id: 'a1', due_at: '2026-08-01T00:00:00.000Z' }], error: null },
      ],
    })
    const record = vi.fn()

    await rescheduleTasks(supabase, {
      ...run,
      ids: ['a1', 'a2'],
      dueAt: '2026-08-01T00:00:00.000Z',
      record,
    })

    expect(record.mock.calls[0][1].undo).toEqual({
      kind: 'reschedule_back',
      groups: [{ dueAt: '2026-07-01T00:00:00.000Z', ids: ['a1', 'a2'] }],
    })
  })
})

describe('recordReviewTool', () => {
  it('records evidence and can retract the row it wrote', async () => {
    const supabase = fakeSupabase({
      artefact_schedule: { data: null, error: null },
      reviews: { data: { id: 'rev1', artefact_id: 'a1', rating: 3, due_at: 'x' }, error: null },
    })
    const record = vi.fn()

    await recordReviewTool(supabase, { ...run, artefactId: 'a1', rating: 3, record })

    expect(record.mock.calls[0][1].undo).toEqual({ kind: 'remove_review', id: 'rev1' })
  })
})

describe('showInInterface', () => {
  it('returns the intent as data and records nothing, because nothing changed', async () => {
    const record = vi.fn()

    const result = await showInInterface(fakeSupabase(), {
      ...run,
      target: 'tasks',
      courseId: 'sub1',
      format: 'flashcard',
      record,
    })

    expect(result.intent).toMatchObject({
      kind: 'navigate',
      path: '/tasks',
      query: { course: 'sub1', type: 'flashcard' },
    })
    expect(record).not.toHaveBeenCalled()
  })

  it('hands the intent to whoever is collecting them for the bar', async () => {
    const intents = []

    await showInInterface(fakeSupabase(), {
      ...run,
      target: 'due',
      onIntent: (intent) => intents.push(intent),
      record: vi.fn(),
    })

    expect(intents).toHaveLength(1)
    expect(intents[0].path).toBe('/tasks/due')
  })

  it('cannot be talked into leaving wissly', async () => {
    await expect(
      showInInterface(fakeSupabase(), { ...run, target: 'https://evil.example', record: vi.fn() }),
    ).rejects.toThrow(/cannot be opened/i)
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

  it('puts an edited payload back', async () => {
    const supabase = fakeSupabase({ artefacts: { data: { id: 'a1' }, error: null } })

    await applyUndo(supabase, {
      undo: { kind: 'restore_artefact', artefactId: 'a1', payload: { front: 'old', back: 'a' } },
    })

    expect(argsOf(supabase.query('artefacts'), 'update')[0]).toEqual({
      payload: { front: 'old', back: 'a' },
    })
  })

  it('moves each artefact back to the course it came from', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [{ id: 'a1' }], error: null } })

    await applyUndo(supabase, {
      undo: { kind: 'move_artefacts_back', previous: { subA: ['a1'], subB: ['a2'] } },
    })

    expect(argsOfAll(supabase.queries('artefacts')[0], 'update')[0][0]).toEqual({
      subject_id: 'subA',
    })
    expect(supabase.queries('artefacts')).toHaveLength(2)
  })

  it('takes an archiving back', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [{ id: 'a1' }], error: null } })

    await applyUndo(supabase, { undo: { kind: 'restore_artefacts', ids: ['a1'] } })

    expect(argsOf(supabase.query('artefacts'), 'update')[0]).toEqual({ archived_at: null })
  })

  it('takes a source archiving back', async () => {
    const supabase = fakeSupabase({ sources: { data: { id: 'src1' }, error: null } })

    await applyUndo(supabase, { undo: { kind: 'restore_source', sourceId: 'src1' } })

    expect(argsOf(supabase.query('sources'), 'update')[0]).toEqual({ archived_at: null })
  })

  it('archives a source it had restored', async () => {
    const supabase = fakeSupabase({ sources: { data: { id: 'src1' }, error: null } })

    await applyUndo(supabase, { undo: { kind: 'archive_source', sourceId: 'src1' } })

    expect(argsOf(supabase.query('sources'), 'update')[0]).toHaveProperty('archived_at')
  })

  it('retracts the review row it wrote', async () => {
    const supabase = fakeSupabase({ reviews: { data: [{ id: 'rev1' }], error: null } })

    await applyUndo(supabase, { undo: { kind: 'remove_review', id: 'rev1' } })

    expect(methodsOf(supabase.query('reviews'))).toContain('delete')
  })

  it('refuses an action it does not know how to reverse', async () => {
    await expect(
      applyUndo(fakeSupabase(), { undo: { kind: 'drop_database' } }),
    ).rejects.toThrow(/cannot be undone/i)
  })
})

describe('WRITE_TOOLS', () => {
  it('is the whole writing surface, and every name says what it does', () => {
    expect(WRITE_TOOLS.map((definition) => definition.name).sort()).toEqual([
      'add_material',
      'archive_source',
      'archive_tasks',
      'build_course_from_goal',
      'create_course',
      'edit_artefact',
      'grade_answer',
      'make_artefacts',
      'move_tasks',
      'record_review',
      'rename_course',
      'reschedule_tasks',
      'restore_source',
      'restore_tasks',
      'show_in_interface',
      'write_artefact',
    ])
  })

  it('tells the learner, through the model, that a rename can be taken back', () => {
    const rename = WRITE_TOOLS.find((definition) => definition.name === 'rename_course')
    expect(rename.description).toMatch(/undo/i)
  })

  it('describes every tool, because the description is the model’s only manual', () => {
    for (const definition of WRITE_TOOLS) {
      expect(definition.description.length, definition.name).toBeGreaterThan(20)
    }
  })

  /* Auth and export are the two acts no undo restores. Not "there is no tool
   * for it today" — there must be no way to name one. */
  it('reaches nothing that touches auth, export or sharing', () => {
    for (const definition of WRITE_TOOLS) {
      expect(definition.name, definition.name).not.toMatch(
        /email|password|account|auth|export|share|download|sign_?out|delete_?user/i,
      )
    }
  })

  it('destroys nothing the learner brought — every removal is soft or a retraction', () => {
    for (const definition of WRITE_TOOLS) {
      expect(definition.name, definition.name).not.toMatch(/^delete_/)
    }
  })

  it('refuses the wrong identity before it writes a single row', async () => {
    const privileged = {
      supabaseKey: 'sb_secret_abc',
      from: () => {
        throw new Error('the query was built, which is already too late')
      },
    }

    for (const definition of WRITE_TOOLS) {
      await expect(
        definition.run(privileged, {
          ...run,
          courseId: 'sub1',
          sourceId: 'src1',
          sectionId: 's1',
          artefactId: 'a1',
          subjectId: 'sub1',
          ids: ['a1'],
          title: 'x',
          instruction: 'x',
          schedule: 'weekly',
          target: 'dashboard',
          format: 'flashcard',
          payload: { front: 'q', back: 'a' },
          rating: 3,
          answer: 'x',
          question: { prompt: 'p', model_answer: 'm', criteria: ['c'] },
          text: 'x',
          course: 'Optics',
          dueAt: '2026-08-01T00:00:00.000Z',
          record: vi.fn(),
          client: { chatStructured: async () => ({}) },
        }),
        definition.name,
      ).rejects.toThrow(/as the learner/i)
    }
  })
})
