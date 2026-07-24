// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import {
  RECALL_FORMATS,
  UNDERSTANDING_FORMATS,
  listArtefacts,
  saveArtefacts,
  toArtefactView,
} from './artefacts.js'

describe('the two kinds of artefact', () => {
  it('keeps read and answered apart, with nothing in both', () => {
    const overlap = UNDERSTANDING_FORMATS.filter((format) => RECALL_FORMATS.includes(format))

    expect(overlap).toEqual([])
    expect([...UNDERSTANDING_FORMATS, ...RECALL_FORMATS].sort()).toEqual([
      'cloze',
      'flashcard',
      'glossary',
      'multiple_choice',
      'open_question',
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
