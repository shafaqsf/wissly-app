// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, argsOfAll, fakeSupabase, methodsOf } from './fake-supabase.js'
import {
  RECALL_FORMATS,
  UNDERSTANDING_FORMATS,
  archiveArtefact,
  archiveArtefacts,
  createArtefact,
  listArtefacts,
  moveArtefacts,
  rescheduleArtefacts,
  restoreArtefact,
  saveArtefacts,
  sectionsWithFormat,
  toArtefactView,
  updateArtefact,
} from './artefacts.js'

describe('the two kinds of artefact', () => {
  it('keeps read and answered apart, with nothing in both', () => {
    const overlap = UNDERSTANDING_FORMATS.filter((format) => RECALL_FORMATS.includes(format))

    expect(overlap).toEqual([])
    expect([...UNDERSTANDING_FORMATS, ...RECALL_FORMATS].sort()).toEqual([
      'cloze',
      'comparison_table',
      'flashcard',
      'glossary',
      'multiple_choice',
      'open_question',
      'ordering',
      'practice_exam',
      'summary',
    ])
  })
})

describe('a row on its way to a renderer', () => {
  it('carries the passage, so the citation can be read in place', () => {
    const view = toArtefactView(
      { id: 'a1', format: 'flashcard', payload: { front: 'F', back: 'B' }, section_id: 'sec-1' },
      { id: 'sec-1', ordinal: 3, content: 'Light bends.', anchor: { page: 12 } },
    )

    expect(view).toMatchObject({
      id: 'a1',
      format: 'flashcard',
      section_ordinal: 3,
      anchor: { page: 12 },
      passage: 'Light bends.',
    })
  })

  it('still renders when the section is gone, minus the passage', () => {
    const view = toArtefactView({ id: 'a1', format: 'flashcard', payload: {}, section_id: null })

    expect(view.passage).toBeNull()
    expect(view.anchor).toBeNull()
    expect(view.section_ordinal).toBeNull()
  })
})

describe('storing what was generated', () => {
  it('stamps the owner on every artefact', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [{ id: 'a1' }], error: null } })

    await saveArtefacts(supabase, {
      userId: 'user-1',
      artefacts: [
        {
          subject_id: 'sub-1',
          section_id: 'sec-1',
          concept_id: 'c1',
          format: 'flashcard',
          payload: { front: 'F', back: 'B' },
          // The generator hands these along for rendering; they are not columns.
          section_ordinal: 1,
          anchor: { page: 2 },
        },
      ],
    })

    expect(argsOf(supabase.query('artefacts'), 'insert')).toEqual([
      [
        {
          user_id: 'user-1',
          subject_id: 'sub-1',
          section_id: 'sec-1',
          concept_id: 'c1',
          format: 'flashcard',
          payload: { front: 'F', back: 'B' },
          // This is the generation path, so the batch is the agent's work.
          origin: 'agent',
        },
      ],
    ])
  })

  it('asks the database nothing when nothing was generated', async () => {
    const supabase = fakeSupabase()

    await expect(saveArtefacts(supabase, { userId: 'user-1', artefacts: [] })).resolves.toEqual([])
    expect(supabase.calls).toHaveLength(0)
  })
})

describe('reading the library', () => {
  it('asks only for the formats that are read, not the ones that are answered', async () => {
    const supabase = fakeSupabase({
      artefacts: { data: [], error: null },
    })

    await listArtefacts(supabase, { subjectId: 'sub-1' })

    const call = supabase.query('artefacts')
    expect(argsOf(call, 'in')).toEqual(['format', UNDERSTANDING_FORMATS])
    expect(argsOf(call, 'eq')).toEqual(['subject_id', 'sub-1'])
  })

  it('fetches every passage in one query, not one per artefact', async () => {
    const supabase = fakeSupabase({
      artefacts: {
        data: [
          { id: 'a1', format: 'summary', payload: {}, section_id: 'sec-1' },
          { id: 'a2', format: 'glossary', payload: {}, section_id: 'sec-2' },
          { id: 'a3', format: 'glossary', payload: {}, section_id: 'sec-1' },
        ],
        error: null,
      },
      sections: {
        data: [
          { id: 'sec-1', ordinal: 1, content: 'One.', anchor: { page: 1 } },
          { id: 'sec-2', ordinal: 2, content: 'Two.', anchor: { page: 2 } },
        ],
        error: null,
      },
    })

    const artefacts = await listArtefacts(supabase, { subjectId: 'sub-1' })

    expect(supabase.queries('sections')).toHaveLength(1)
    expect(argsOf(supabase.query('sections'), 'in')).toEqual(['id', ['sec-1', 'sec-2']])
    expect(artefacts.map((artefact) => artefact.passage)).toEqual(['One.', 'Two.', 'One.'])
  })

  it('skips the section query when no artefact cites one', async () => {
    const supabase = fakeSupabase({
      artefacts: { data: [{ id: 'a1', format: 'summary', payload: {}, section_id: null }], error: null },
    })

    await listArtefacts(supabase, { subjectId: 'sub-1' })

    expect(supabase.query('sections')).toBeUndefined()
  })
})

describe('writing one card by hand', () => {
  it('records that the learner wrote it, not the agent', async () => {
    const supabase = fakeSupabase({ artefacts: { data: { id: 'a1' }, error: null } })

    await createArtefact(supabase, {
      userId: 'user-1',
      subjectId: 'sub-1',
      sectionId: 'sec-1',
      conceptId: 'c1',
      format: 'flashcard',
      payload: { front: 'F', back: 'B' },
    })

    expect(argsOf(supabase.query('artefacts'), 'insert')).toEqual([
      {
        user_id: 'user-1',
        subject_id: 'sub-1',
        section_id: 'sec-1',
        concept_id: 'c1',
        format: 'flashcard',
        payload: { front: 'F', back: 'B' },
        origin: 'manual',
      },
    ])
  })

  it('lets the agent say so when it is the agent writing', async () => {
    const supabase = fakeSupabase({ artefacts: { data: { id: 'a1' }, error: null } })

    await createArtefact(supabase, {
      userId: 'user-1',
      subjectId: 'sub-1',
      format: 'cloze',
      payload: { text: 'a ____ b', answer: 'x' },
      origin: 'agent',
    })

    const [row] = argsOf(supabase.query('artefacts'), 'insert')
    expect(row.origin).toBe('agent')
  })

  it('refuses an origin the column would reject anyway', async () => {
    const supabase = fakeSupabase()

    await expect(
      createArtefact(supabase, {
        userId: 'user-1',
        subjectId: 'sub-1',
        format: 'cloze',
        payload: {},
        origin: 'import',
      }),
    ).rejects.toThrow(/import/)
    expect(supabase.calls).toHaveLength(0)
  })

  it('refuses a format that is not in the catalogue', async () => {
    const supabase = fakeSupabase()

    await expect(
      createArtefact(supabase, {
        userId: 'user-1',
        subjectId: 'sub-1',
        format: 'concept_map',
        payload: {},
      }),
    ).rejects.toThrow(/concept_map/)
  })
})

describe('editing and archiving', () => {
  it('writes only what changed', async () => {
    const supabase = fakeSupabase({ artefacts: { data: { id: 'a1' }, error: null } })

    await updateArtefact(supabase, { id: 'a1', payload: { front: 'F2', back: 'B' } })

    expect(argsOf(supabase.query('artefacts'), 'update')).toEqual([
      { payload: { front: 'F2', back: 'B' } },
    ])
  })

  it('refuses an update that says nothing', async () => {
    const supabase = fakeSupabase()

    await expect(updateArtefact(supabase, { id: 'a1' })).rejects.toThrow(/nothing/i)
    expect(supabase.calls).toHaveLength(0)
  })

  it('archives one by writing a timestamp, never by deleting', async () => {
    const supabase = fakeSupabase({ artefacts: { data: { id: 'a1' }, error: null } })
    const now = () => new Date('2026-07-25T09:00:00.000Z')

    await archiveArtefact(supabase, { id: 'a1', now })

    const call = supabase.query('artefacts')
    expect(methodsOf(call)).not.toContain('delete')
    expect(argsOf(call, 'update')).toEqual([{ archived_at: '2026-07-25T09:00:00.000Z' }])
  })

  it('restores one by clearing it', async () => {
    const supabase = fakeSupabase({ artefacts: { data: { id: 'a1' }, error: null } })

    await restoreArtefact(supabase, { id: 'a1' })

    expect(argsOf(supabase.query('artefacts'), 'update')).toEqual([{ archived_at: null }])
  })
})

describe('acting on a selection', () => {
  it('archives every selected row in one statement', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [{ id: 'a1' }, { id: 'a2' }], error: null } })
    const now = () => new Date('2026-07-25T09:00:00.000Z')

    await archiveArtefacts(supabase, { ids: ['a1', 'a2'], now })

    expect(supabase.queries('artefacts')).toHaveLength(1)
    expect(argsOf(supabase.query('artefacts'), 'in')).toEqual(['id', ['a1', 'a2']])
  })

  it('moves a selection to another course in one statement', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [{ id: 'a1' }], error: null } })

    await moveArtefacts(supabase, { ids: ['a1'], subjectId: 'sub-2' })

    const call = supabase.query('artefacts')
    expect(argsOf(call, 'update')).toEqual([{ subject_id: 'sub-2' }])
    expect(argsOf(call, 'in')).toEqual(['id', ['a1']])
  })

  it('asks the database nothing for an empty selection', async () => {
    const supabase = fakeSupabase()

    await expect(archiveArtefacts(supabase, { ids: [] })).resolves.toEqual([])
    await expect(moveArtefacts(supabase, { ids: [], subjectId: 'sub-2' })).resolves.toEqual([])
    await expect(rescheduleArtefacts(supabase, { ids: [], dueAt: new Date() })).resolves.toEqual([])
    expect(supabase.calls).toHaveLength(0)
  })

  it('reschedules by moving the latest review of each artefact, not its history', async () => {
    const supabase = fakeSupabase({
      reviews: [
        {
          data: [
            { id: 'r3', artefact_id: 'a1', reviewed_at: '2026-07-02T00:00:00.000Z' },
            { id: 'r2', artefact_id: 'a1', reviewed_at: '2026-07-01T00:00:00.000Z' },
            { id: 'r9', artefact_id: 'a2', reviewed_at: '2026-06-01T00:00:00.000Z' },
          ],
          error: null,
        },
        { data: [{ id: 'r3' }, { id: 'r9' }], error: null },
      ],
    })

    const moved = await rescheduleArtefacts(supabase, {
      ids: ['a1', 'a2'],
      dueAt: new Date('2026-08-01T00:00:00.000Z'),
    })

    const [read, write] = supabase.queries('reviews')
    expect(argsOf(read, 'in')).toEqual(['artefact_id', ['a1', 'a2']])
    expect(argsOf(write, 'update')).toEqual([{ due_at: '2026-08-01T00:00:00.000Z' }])
    expect(argsOf(write, 'in')).toEqual(['id', ['r3', 'r9']])
    expect(moved).toEqual([{ id: 'r3' }, { id: 'r9' }])
  })

  it('leaves a never-reviewed artefact alone — it is already due now', async () => {
    const supabase = fakeSupabase({ reviews: { data: [], error: null } })

    await expect(
      rescheduleArtefacts(supabase, { ids: ['a1'], dueAt: new Date() }),
    ).resolves.toEqual([])
    expect(supabase.queries('reviews')).toHaveLength(1)
  })
})

describe('duplicate protection', () => {
  it('says which sections already have this format, before anything is spent', async () => {
    const supabase = fakeSupabase({
      artefacts: {
        data: [{ section_id: 'sec-1' }, { section_id: 'sec-3' }, { section_id: 'sec-1' }],
        error: null,
      },
    })

    const covered = await sectionsWithFormat(supabase, {
      format: 'flashcard',
      sectionIds: ['sec-1', 'sec-2', 'sec-3'],
    })

    expect(covered).toEqual(['sec-1', 'sec-3'])

    const call = supabase.query('artefacts')
    expect(argsOfAll(call, 'eq')).toContainEqual(['format', 'flashcard'])
    expect(argsOf(call, 'in')).toEqual(['section_id', ['sec-1', 'sec-2', 'sec-3']])
    // An archived card is not protection against making another one.
    expect(argsOf(call, 'is')).toEqual(['archived_at', null])
  })

  it('can ask across a whole course instead of a named set of sections', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [], error: null } })

    await sectionsWithFormat(supabase, { format: 'cloze', subjectId: 'sub-1' })

    expect(argsOfAll(supabase.query('artefacts'), 'eq')).toContainEqual(['subject_id', 'sub-1'])
  })

  it('asks nothing when there is nothing to check', async () => {
    const supabase = fakeSupabase()

    await expect(
      sectionsWithFormat(supabase, { format: 'cloze', sectionIds: [] }),
    ).resolves.toEqual([])
    expect(supabase.calls).toHaveLength(0)
  })
})

describe('the task workbench filter', () => {
  it('narrows by course, section and format at once', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [], error: null } })

    await listArtefacts(supabase, {
      subjectId: 'sub-1',
      sectionId: 'sec-1',
      formats: ['flashcard'],
    })

    const call = supabase.query('artefacts')
    expect(argsOfAll(call, 'eq')).toEqual([
      ['subject_id', 'sub-1'],
      ['section_id', 'sec-1'],
    ])
    expect(argsOf(call, 'in')).toEqual(['format', ['flashcard']])
    expect(argsOf(call, 'is')).toEqual(['archived_at', null])
  })

  it('turns a source into its sections first, because artefacts do not carry one', async () => {
    const supabase = fakeSupabase({
      sections: [
        { data: [{ id: 'sec-1' }, { id: 'sec-2' }], error: null },
        { data: [], error: null },
      ],
      artefacts: { data: [], error: null },
    })

    await listArtefacts(supabase, { sourceId: 'src-1', formats: ['flashcard'] })

    const [sectionsOfSource] = supabase.queries('sections')
    expect(argsOf(sectionsOfSource, 'eq')).toEqual(['source_id', 'src-1'])
    expect(argsOfAll(supabase.query('artefacts'), 'in')).toContainEqual([
      'section_id',
      ['sec-1', 'sec-2'],
    ])
  })

  it('answers with nothing for a source that has no sections, without asking further', async () => {
    const supabase = fakeSupabase({ sections: { data: [], error: null } })

    await expect(listArtefacts(supabase, { sourceId: 'src-1' })).resolves.toEqual([])
    expect(supabase.query('artefacts')).toBeUndefined()
  })

  it('shows the archive when it is asked for', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [], error: null } })

    await listArtefacts(supabase, { subjectId: 'sub-1', archived: true })

    const call = supabase.query('artefacts')
    expect(methodsOf(call)).not.toContain('is')
    expect(argsOf(call, 'not')).toEqual(['archived_at', 'is', null])
  })
})
