// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import {
  createConceptLinks,
  existingPairs,
  linksAmong,
  listSeeAlso,
  pairKey,
  seeAlsoForSubject,
} from './concept-links.js'

describe('pairKey', () => {
  it('is the same whichever order the two ids arrive in', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'))
  })
})

describe('createConceptLinks', () => {
  it('writes one row per link, owner stamped', async () => {
    const supabase = fakeSupabase({
      concept_links: { data: [{ id: 'l1' }, { id: 'l2' }], error: null },
    })

    await createConceptLinks(supabase, {
      userId: 'user-1',
      links: [
        { conceptId: 'c1', relatedConceptId: 'c2', reason: 'Both about light.' },
        { conceptId: 'c1', relatedConceptId: 'c3', reason: 'Both use the same formula.' },
      ],
    })

    expect(argsOf(supabase.query('concept_links'), 'insert')).toEqual([
      [
        { user_id: 'user-1', concept_id: 'c1', related_concept_id: 'c2', reason: 'Both about light.' },
        { user_id: 'user-1', concept_id: 'c1', related_concept_id: 'c3', reason: 'Both use the same formula.' },
      ],
    ])
  })

  it('asks the database nothing when there are no links', async () => {
    const supabase = fakeSupabase()

    await expect(createConceptLinks(supabase, { userId: 'user-1', links: [] })).resolves.toEqual([])
    expect(supabase.calls).toHaveLength(0)
  })
})

describe('listSeeAlso', () => {
  it('returns the other concept in each pair, with the reason', async () => {
    const supabase = fakeSupabase({
      concept_links: [
        { data: [{ id: 'l1', concept_id: 'c1', related_concept_id: 'c2', reason: 'Both about light.' }], error: null },
        { data: [], error: null },
      ],
      concepts: { data: [{ id: 'c2', term: 'Snell\'s law', subject_id: 'sub-2' }], error: null },
    })

    const seeAlso = await listSeeAlso(supabase, { conceptId: 'c1' })

    expect(seeAlso).toEqual([
      { id: 'l1', conceptId: 'c2', term: 'Snell\'s law', subjectId: 'sub-2', reason: 'Both about light.' },
    ])
  })

  it('finds the pair whichever side named the concept', async () => {
    const supabase = fakeSupabase({
      concept_links: [
        { data: [], error: null },
        { data: [{ id: 'l1', concept_id: 'c2', related_concept_id: 'c1', reason: 'Both about light.' }], error: null },
      ],
      concepts: { data: [{ id: 'c2', term: 'Snell\'s law', subject_id: 'sub-2' }], error: null },
    })

    const seeAlso = await listSeeAlso(supabase, { conceptId: 'c1' })

    expect(seeAlso).toEqual([
      { id: 'l1', conceptId: 'c2', term: 'Snell\'s law', subjectId: 'sub-2', reason: 'Both about light.' },
    ])
  })

  it('asks the database nothing without a concept id', async () => {
    const supabase = fakeSupabase()

    await expect(listSeeAlso(supabase, {})).resolves.toEqual([])
    expect(supabase.calls).toHaveLength(0)
  })
})

describe('seeAlsoForSubject', () => {
  it('groups the see-also list per concept of the course', async () => {
    const supabase = fakeSupabase({
      concepts: [
        { data: [{ id: 'c1' }, { id: 'c2' }], error: null },
        { data: [{ id: 'c3', term: 'Cellular respiration', subject_id: 'sub-2' }], error: null },
      ],
      concept_links: [
        { data: [{ id: 'l1', concept_id: 'c2', related_concept_id: 'c3', reason: 'Same energy idea.' }], error: null },
        { data: [], error: null },
      ],
    })

    const grouped = await seeAlsoForSubject(supabase, { subjectId: 'sub-1' })

    expect(grouped.get('c1')).toEqual([])
    expect(grouped.get('c2')).toEqual([
      { id: 'l1', conceptId: 'c3', term: 'Cellular respiration', subjectId: 'sub-2', reason: 'Same energy idea.' },
    ])
  })

  it('asks the database nothing when the course has no concepts', async () => {
    const supabase = fakeSupabase({ concepts: { data: [], error: null } })

    const grouped = await seeAlsoForSubject(supabase, { subjectId: 'sub-1' })

    expect(grouped.size).toBe(0)
    expect(supabase.query('concept_links')).toBeUndefined()
  })
})

describe('existingPairs', () => {
  it('is a set of pair keys, so a caller can dedupe against it', async () => {
    const supabase = fakeSupabase({
      concept_links: [
        { data: [{ id: 'l1', concept_id: 'c1', related_concept_id: 'c2', reason: 'x' }], error: null },
        { data: [], error: null },
      ],
    })

    const pairs = await existingPairs(supabase, { conceptIds: ['c1'] })

    expect(pairs.has(pairKey('c1', 'c2'))).toBe(true)
  })
})

describe('linksAmong', () => {
  it('keeps only links whose both ends are in the given set', async () => {
    const supabase = fakeSupabase({
      concept_links: {
        data: [
          { id: 'l1', concept_id: 'c1', related_concept_id: 'c2', reason: 'in course' },
          { id: 'l2', concept_id: 'c1', related_concept_id: 'x9', reason: 'outside course' },
        ],
        error: null,
      },
    })

    const links = await linksAmong(supabase, { conceptIds: ['c1', 'c2'] })

    expect(links).toEqual([
      { id: 'l1', concept_id: 'c1', related_concept_id: 'c2', reason: 'in course' },
    ])
  })

  it('asks the database nothing for an empty set', async () => {
    const supabase = fakeSupabase()

    await expect(linksAmong(supabase, { conceptIds: [] })).resolves.toEqual([])
    expect(supabase.calls).toHaveLength(0)
  })
})
