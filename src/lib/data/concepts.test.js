// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import {
  candidateConcepts,
  conceptNameFor,
  createConceptsForSections,
  listConceptMastery,
} from './concepts.js'

describe('naming a concept', () => {
  it('uses the author\'s own heading when the source gave one', () => {
    const name = conceptNameFor({
      content: 'Light bends at a boundary.',
      anchor: { heading: 'Refraction', start: 0, end: 26 },
    })

    expect(name).toBe('Refraction')
  })

  it('falls back to the opening sentence', () => {
    const name = conceptNameFor({
      content: 'Light bends at a boundary. The angle follows Snell\'s law.',
      anchor: { page: 3 },
    })

    expect(name).toBe('Light bends at a boundary.')
  })

  it('cuts a long opening at a word, never mid-word', () => {
    const name = conceptNameFor({
      content: `${'refraction '.repeat(12)}happens`,
    })

    expect(name.length).toBeLessThanOrEqual(61)
    expect(name.endsWith('…')).toBe(true)
    expect(name).not.toMatch(/refracti…$/)
  })

  it('survives a section with no content at all', () => {
    expect(conceptNameFor({})).toBe('')
    expect(conceptNameFor(null)).toBe('')
  })
})

describe('naming what a source covers', () => {
  it('writes one concept per section, owner stamped', async () => {
    const supabase = fakeSupabase({
      concepts: { data: [{ id: 'c1' }, { id: 'c2' }], error: null },
    })

    await createConceptsForSections(supabase, {
      userId: 'user-1',
      subjectId: 'sub-1',
      sections: [
        { id: 'sec-1', content: 'One.', anchor: { heading: 'First' } },
        { id: 'sec-2', content: 'Two.', anchor: { heading: 'Second' } },
      ],
    })

    expect(argsOf(supabase.query('concepts'), 'insert')).toEqual([
      [
        { user_id: 'user-1', subject_id: 'sub-1', term: 'First', section_id: 'sec-1' },
        { user_id: 'user-1', subject_id: 'sub-1', term: 'Second', section_id: 'sec-2' },
      ],
    ])
  })

  it('asks the database nothing when there are no sections', async () => {
    const supabase = fakeSupabase()

    await expect(
      createConceptsForSections(supabase, { userId: 'user-1', subjectId: 'sub-1', sections: [] }),
    ).resolves.toEqual([])
    expect(supabase.calls).toHaveLength(0)
  })
})

describe('mastery per concept', () => {
  it('joins the score onto the name, because the view carries no term', async () => {
    const supabase = fakeSupabase({
      concepts: {
        data: [{ id: 'c1', subject_id: 'sub-1', term: 'Refraction' }],
        error: null,
      },
      concept_mastery: { data: [{ concept_id: 'c1', mastery: '0.667' }], error: null },
    })

    const concepts = await listConceptMastery(supabase, { subjectId: 'sub-1' })

    expect(concepts).toEqual([
      { id: 'c1', subjectId: 'sub-1', name: 'Refraction', mastery: 0.667 },
    ])
  })

  it('reads a concept the view has not scored as untouched, not as missing', async () => {
    const supabase = fakeSupabase({
      concepts: {
        data: [{ id: 'c1', subject_id: 'sub-1', term: 'Refraction' }],
        error: null,
      },
      concept_mastery: { data: [], error: null },
    })

    const concepts = await listConceptMastery(supabase, { subjectId: 'sub-1' })

    expect(concepts).toEqual([
      { id: 'c1', subjectId: 'sub-1', name: 'Refraction', mastery: 0 },
    ])
  })

  it('keeps the course each concept belongs to, so a caller can group by it', async () => {
    const supabase = fakeSupabase({
      concepts: {
        data: [
          { id: 'c1', subject_id: 'sub-1', term: 'Refraction' },
          { id: 'c2', subject_id: 'sub-2', term: 'Factoring' },
        ],
        error: null,
      },
      concept_mastery: { data: [], error: null },
    })

    const concepts = await listConceptMastery(supabase)

    expect(concepts.map((concept) => concept.subjectId)).toEqual(['sub-1', 'sub-2'])
  })

  it('does not ask for scores when there are no concepts', async () => {
    const supabase = fakeSupabase({ concepts: { data: [], error: null } })

    await expect(listConceptMastery(supabase, { subjectId: 'sub-1' })).resolves.toEqual([])
    expect(supabase.query('concept_mastery')).toBeUndefined()
  })
})

describe('candidateConcepts', () => {
  it('names the course each candidate belongs to', async () => {
    const supabase = fakeSupabase({
      concepts: {
        data: [{ id: 'x1', term: 'Cellular respiration', definition: 'Sugar into energy.', subject_id: 'sub-2' }],
        error: null,
      },
      subjects: { data: [{ id: 'sub-2', title: 'Biology' }], error: null },
    })

    const candidates = await candidateConcepts(supabase, { excludeIds: ['c1'] })

    expect(candidates).toEqual([
      {
        id: 'x1',
        term: 'Cellular respiration',
        definition: 'Sugar into energy.',
        subjectId: 'sub-2',
        courseTitle: 'Biology',
      },
    ])
  })

  it('excludes the given ids from the candidate list', async () => {
    const supabase = fakeSupabase({
      concepts: { data: [], error: null },
      subjects: { data: [], error: null },
    })

    await candidateConcepts(supabase, { excludeIds: ['c1', 'c2'] })

    expect(argsOf(supabase.query('concepts'), 'not')).toEqual(['id', 'in', '(c1,c2)'])
  })

  it('asks the database nothing further when there is nothing to name', async () => {
    const supabase = fakeSupabase({ concepts: { data: [], error: null } })

    await expect(candidateConcepts(supabase, {})).resolves.toEqual([])
    expect(supabase.query('subjects')).toBeUndefined()
  })
})
