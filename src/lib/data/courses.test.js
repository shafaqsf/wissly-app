// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { fakeSupabase } from './fake-supabase.js'
import { listCourses } from './courses.js'

describe('the courses a learner has', () => {
  it('files material and settled concepts under the course they belong to', async () => {
    const supabase = fakeSupabase({
      subjects: {
        data: [
          { id: 'sub-1', title: 'Optics' },
          { id: 'sub-2', title: 'Algebra' },
        ],
        error: null,
      },
      sources: {
        data: [
          { id: 'src-1', subject_id: 'sub-1' },
          { id: 'src-2', subject_id: 'sub-1' },
          { id: 'src-3', subject_id: 'sub-2' },
        ],
        error: null,
      },
      concepts: {
        data: [
          { id: 'c1', subject_id: 'sub-1', term: 'Refraction' },
          { id: 'c2', subject_id: 'sub-1', term: 'Snell' },
          { id: 'c3', subject_id: 'sub-2', term: 'Factoring' },
        ],
        error: null,
      },
      concept_mastery: {
        data: [
          { concept_id: 'c1', mastery: '0.95' },
          { concept_id: 'c2', mastery: '0.3' },
        ],
        error: null,
      },
    })

    await expect(listCourses(supabase)).resolves.toEqual([
      { id: 'sub-1', title: 'Optics', sources: 2, concepts: 2, settled: 1 },
      { id: 'sub-2', title: 'Algebra', sources: 1, concepts: 1, settled: 0 },
    ])
  })

  it('reads a course nothing has been added to yet as empty, not as missing', async () => {
    const supabase = fakeSupabase({
      subjects: { data: [{ id: 'sub-1', title: 'Optics' }], error: null },
      sources: { data: [], error: null },
      concepts: { data: [], error: null },
    })

    await expect(listCourses(supabase)).resolves.toEqual([
      { id: 'sub-1', title: 'Optics', sources: 0, concepts: 0, settled: 0 },
    ])
  })

  it('answers with no courses when the learner has none', async () => {
    const supabase = fakeSupabase({
      subjects: { data: [], error: null },
      sources: { data: [], error: null },
      concepts: { data: [], error: null },
    })

    await expect(listCourses(supabase)).resolves.toEqual([])
  })
})
