// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { fakeSupabase } from './fake-supabase.js'
import { conceptGraph } from './concept-graph.js'

describe('conceptGraph', () => {
  it('has no nodes and no edges for an empty course', async () => {
    const supabase = fakeSupabase({ concepts: { data: [], error: null } })

    await expect(conceptGraph(supabase, { subjectId: 'sub-1' })).resolves.toEqual({
      nodes: [],
      edges: [],
    })
  })

  it('draws an edge for every explicit link between two of the course\'s concepts', async () => {
    const supabase = fakeSupabase({
      concepts: {
        data: [
          { id: 'c1', subject_id: 'sub-1', term: 'Refraction' },
          { id: 'c2', subject_id: 'sub-1', term: 'Snell\'s law' },
        ],
        error: null,
      },
      concept_mastery: { data: [], error: null },
      concept_links: {
        data: [{ id: 'l1', concept_id: 'c1', related_concept_id: 'c2', reason: 'Same idea.' }],
        error: null,
      },
    })

    const graph = await conceptGraph(supabase, { subjectId: 'sub-1' })

    expect(graph.nodes).toEqual([
      { id: 'c1', name: 'Refraction', mastery: 0, subjectId: 'sub-1' },
      { id: 'c2', name: 'Snell\'s law', mastery: 0, subjectId: 'sub-1' },
    ])
    expect(graph.edges).toEqual([
      { source: 'c1', target: 'c2', reason: 'Same idea.', kind: 'link' },
    ])
  })

  it('falls back to co-occurrence within the same source when there are no explicit links', async () => {
    const supabase = fakeSupabase({
      concepts: [
        {
          data: [
            { id: 'c1', subject_id: 'sub-1', term: 'Refraction' },
            { id: 'c2', subject_id: 'sub-1', term: 'Snell\'s law' },
            { id: 'c3', subject_id: 'sub-1', term: 'Diffraction' },
          ],
          error: null,
        },
        {
          data: [
            { id: 'c1', section_id: 'sec-1' },
            { id: 'c2', section_id: 'sec-2' },
            { id: 'c3', section_id: 'sec-3' },
          ],
          error: null,
        },
      ],
      concept_mastery: { data: [], error: null },
      concept_links: { data: [], error: null },
      sections: {
        data: [
          { id: 'sec-1', source_id: 'src-1' },
          { id: 'sec-2', source_id: 'src-1' },
          { id: 'sec-3', source_id: 'src-2' },
        ],
        error: null,
      },
    })

    const graph = await conceptGraph(supabase, { subjectId: 'sub-1' })

    expect(graph.edges).toEqual([{ source: 'c1', target: 'c2', reason: null, kind: 'cooccurrence' }])
  })

  it('never draws an edge to a concept outside the course', async () => {
    const supabase = fakeSupabase({
      concepts: {
        data: [{ id: 'c1', subject_id: 'sub-1', term: 'Refraction' }],
        error: null,
      },
      concept_mastery: { data: [], error: null },
      concept_links: {
        data: [{ id: 'l1', concept_id: 'c1', related_concept_id: 'x9', reason: 'cross-course' }],
        error: null,
      },
    })

    const graph = await conceptGraph(supabase, { subjectId: 'sub-1' })

    expect(graph.edges).toEqual([])
  })
})
