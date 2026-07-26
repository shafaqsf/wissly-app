// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { allDataBundle, courseBundle } from './export.js'
import { fakeSupabase } from './fake-supabase.js'

/* The bundle is what export hands to `src/lib/export/*` and what
 * `src/lib/import/json.js` reads back — full fidelity means every field
 * those two need is here, not derived later from something that was
 * dropped. */

function supabaseFor({
  subjects = [],
  sources = [],
  sections = [],
  concepts = [],
  conceptMastery = [],
  artefacts = [],
  reviews = [],
} = {}) {
  return fakeSupabase({
    subjects: { data: subjects, error: null },
    sources: { data: sources, error: null },
    sections: { data: sections, error: null },
    concepts: { data: concepts, error: null },
    concept_mastery: { data: conceptMastery, error: null },
    artefacts: { data: artefacts, error: null },
    reviews: { data: reviews, error: null },
  })
}

const subject = { id: 's1', title: 'Optics' }
const source = { id: 'src1', subject_id: 's1', kind: 'text', title: 'Chapter 1', archived_at: null }
const section = { id: 'sec1', source_id: 'src1', ordinal: 1, content: 'Light bends.', anchor: { page: 1 } }
const concept = { id: 'c1', subject_id: 's1', term: 'Refraction', definition: null, section_id: 'sec1' }
const artefact = {
  id: 'a1',
  subject_id: 's1',
  section_id: 'sec1',
  concept_id: 'c1',
  format: 'flashcard',
  payload: { front: 'What bends light?', back: 'A change of medium.' },
  origin: 'agent',
  archived_at: null,
  created_at: 't0',
}
const review = {
  id: 'r1',
  artefact_id: 'a1',
  reviewed_at: 't1',
  rating: 3,
  stability: 2.5,
  difficulty: 4,
  due_at: 't2',
  reps: 1,
  lapses: 0,
}

describe('courseBundle', () => {
  it('returns null when the course is not there', async () => {
    const supabase = fakeSupabase({ subjects: { data: null, error: null } })

    await expect(courseBundle(supabase, { subjectId: 's1' })).resolves.toBeNull()
  })

  it('gathers one course with everything it holds, at full fidelity', async () => {
    // `subjectById` reads one row with `maybeSingle`, unlike every other read
    // here, which lists — the fixture reflects that shape rather than the
    // list one `allDataBundle` needs below.
    const supabase = fakeSupabase({
      subjects: { data: subject, error: null },
      sources: { data: [source], error: null },
      sections: { data: [section], error: null },
      concepts: { data: [concept], error: null },
      artefacts: { data: [artefact], error: null },
      reviews: { data: [review], error: null },
    })

    const bundle = await courseBundle(supabase, { subjectId: 's1' })

    expect(bundle.courses).toHaveLength(1)
    const [course] = bundle.courses
    expect(course.subject).toMatchObject({ id: 's1', title: 'Optics' })
    expect(course.sources[0]).toMatchObject({ id: 'src1', title: 'Chapter 1' })
    expect(course.sources[0].sections[0]).toMatchObject({ id: 'sec1', content: 'Light bends.' })
    expect(course.concepts[0]).toMatchObject({ id: 'c1', term: 'Refraction' })
    expect(course.artefacts[0]).toMatchObject({ id: 'a1', format: 'flashcard' })
    expect(course.reviews[0]).toMatchObject({ artefact_id: 'a1', rating: 3 })
  })
})

describe('allDataBundle', () => {
  it('gathers every course the learner has', async () => {
    const supabase = supabaseFor({
      subjects: [subject, { id: 's2', title: 'Thermodynamics' }],
      sources: [],
      sections: [],
      concepts: [],
      artefacts: [],
      reviews: [],
    })

    const bundle = await allDataBundle(supabase)

    expect(bundle.courses.map((course) => course.subject.title)).toEqual([
      'Optics',
      'Thermodynamics',
    ])
  })

  it('stamps when the export happened', async () => {
    const supabase = supabaseFor()

    const bundle = await allDataBundle(supabase)

    expect(typeof bundle.exported_at).toBe('string')
    expect(new Date(bundle.exported_at).toString()).not.toBe('Invalid Date')
  })
})
