// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from '../data/fake-supabase.js'
import { importBundle } from './json.js'

/* The other half of the round trip `src/lib/data/export.js` starts. Every
 * insert is asserted on its payload rather than on a count, because a JSON
 * export that comes back with the wrong course title or a foreign key
 * pointing at the wrong row is not a round trip — it just looks like one
 * until the learner opens it. */

function supabaseFor() {
  return fakeSupabase({
    subjects: { data: { id: 'new-subject' }, error: null },
    sources: { data: { id: 'new-source' }, error: null },
    sections: { data: [{ id: 'new-section' }], error: null },
    concepts: { data: [{ id: 'new-concept' }], error: null },
    artefacts: { data: [{ id: 'new-artefact' }], error: null },
    reviews: { data: [{ id: 'new-review' }], error: null },
  })
}

const bundle = {
  exported_at: '2026-07-26T00:00:00.000Z',
  courses: [
    {
      subject: { id: 'old-subject', title: 'Optics' },
      sources: [
        {
          id: 'old-source',
          title: 'Chapter 1',
          kind: 'text',
          raw_text: 'Light bends.',
          archived_at: null,
          sections: [
            { id: 'old-section', ordinal: 1, content: 'Light bends.', anchor: { page: 4 } },
          ],
        },
      ],
      concepts: [
        { id: 'old-concept', term: 'Refraction', definition: 'Bending of light.', section_id: 'old-section' },
      ],
      artefacts: [
        {
          id: 'old-artefact',
          section_id: 'old-section',
          concept_id: 'old-concept',
          format: 'flashcard',
          payload: { front: 'What bends light?', back: 'A change of medium.' },
          origin: 'agent',
          archived_at: null,
        },
      ],
      reviews: [
        {
          artefact_id: 'old-artefact',
          reviewed_at: '2026-07-20T00:00:00.000Z',
          rating: 3,
          stability: 2.5,
          difficulty: 4,
          due_at: '2026-08-01T00:00:00.000Z',
          reps: 1,
          lapses: 0,
        },
      ],
    },
  ],
}

describe('importBundle', () => {
  it('refuses a file that is not a wissly export', async () => {
    const supabase = fakeSupabase()

    await expect(importBundle(supabase, { userId: 'u1', bundle: { foo: 'bar' } })).rejects.toThrow(
      /not a wissly export/i,
    )
  })

  it('creates a new course under the importing learner, with the exported title', async () => {
    const supabase = supabaseFor()

    await importBundle(supabase, { userId: 'u1', bundle })

    const [row] = argsOf(supabase.query('subjects'), 'insert')
    expect(row).toMatchObject({ user_id: 'u1', title: 'Optics' })
    expect(row.id).not.toBe('old-subject')
  })

  it('stores the source and its sections under the new course', async () => {
    const supabase = supabaseFor()

    await importBundle(supabase, { userId: 'u1', bundle })

    const [sourceRow] = argsOf(supabase.query('sources'), 'insert')
    expect(sourceRow).toMatchObject({ user_id: 'u1', title: 'Chapter 1', raw_text: 'Light bends.' })

    const [sectionRows] = argsOf(supabase.query('sections'), 'insert')
    expect(sectionRows).toHaveLength(1)
    expect(sectionRows[0]).toMatchObject({
      user_id: 'u1',
      ordinal: 1,
      content: 'Light bends.',
      anchor: { page: 4 },
      source_id: sourceRow.id,
    })
  })

  it('preserves the concept’s term and definition, remapped onto the new section', async () => {
    const supabase = supabaseFor()

    await importBundle(supabase, { userId: 'u1', bundle })

    const [sectionRows] = argsOf(supabase.query('sections'), 'insert')
    const [conceptRows] = argsOf(supabase.query('concepts'), 'insert')

    expect(conceptRows[0]).toMatchObject({
      user_id: 'u1',
      term: 'Refraction',
      definition: 'Bending of light.',
      section_id: sectionRows[0].id,
    })
  })

  it('preserves the artefact payload and origin, remapped onto the new section and concept', async () => {
    const supabase = supabaseFor()

    await importBundle(supabase, { userId: 'u1', bundle })

    const [sectionRows] = argsOf(supabase.query('sections'), 'insert')
    const [conceptRows] = argsOf(supabase.query('concepts'), 'insert')
    const [artefactRows] = argsOf(supabase.query('artefacts'), 'insert')

    expect(artefactRows[0]).toMatchObject({
      user_id: 'u1',
      format: 'flashcard',
      payload: { front: 'What bends light?', back: 'A change of medium.' },
      origin: 'agent',
      section_id: sectionRows[0].id,
      concept_id: conceptRows[0].id,
    })
  })

  it('preserves the review history, remapped onto the new artefact', async () => {
    const supabase = supabaseFor()

    await importBundle(supabase, { userId: 'u1', bundle })

    const [artefactRows] = argsOf(supabase.query('artefacts'), 'insert')
    const [reviewRows] = argsOf(supabase.query('reviews'), 'insert')

    expect(reviewRows[0]).toMatchObject({
      user_id: 'u1',
      artefact_id: artefactRows[0].id,
      rating: 3,
      stability: 2.5,
      due_at: '2026-08-01T00:00:00.000Z',
    })
  })

  it('reports what it imported, per kind', async () => {
    const supabase = supabaseFor()

    const summary = await importBundle(supabase, { userId: 'u1', bundle })

    expect(summary).toEqual({
      courses: 1,
      sources: 1,
      sections: 1,
      concepts: 1,
      artefacts: 1,
      reviews: 1,
    })
  })

  it('imports several courses from one bundle', async () => {
    const supabase = supabaseFor()
    const twoCourses = {
      ...bundle,
      courses: [
        bundle.courses[0],
        { subject: { title: 'Thermodynamics' }, sources: [], concepts: [], artefacts: [], reviews: [] },
      ],
    }

    const summary = await importBundle(supabase, { userId: 'u1', bundle: twoCourses })

    expect(summary.courses).toBe(2)
  })

  it('drops a review whose artefact was not in the bundle, rather than crashing on a dangling id', async () => {
    const supabase = supabaseFor()
    const dangling = {
      ...bundle,
      courses: [
        {
          ...bundle.courses[0],
          reviews: [...bundle.courses[0].reviews, { artefact_id: 'ghost', rating: 2 }],
        },
      ],
    }

    const summary = await importBundle(supabase, { userId: 'u1', bundle: dangling })

    expect(summary.reviews).toBe(1)
  })
})
