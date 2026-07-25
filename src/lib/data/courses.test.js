// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import { courseById, createCourse, listCourses } from './courses.js'

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

describe('creating a course', () => {
  it('is a thing the learner does, not a side effect of adding material', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 'sub-1', title: 'Optics' }, error: null },
    })

    await expect(createCourse(supabase, { userId: 'user-1', title: '  Optics  ' })).resolves.toEqual(
      { id: 'sub-1', title: 'Optics' },
    )

    expect(argsOf(supabase.query('subjects'), 'insert')).toEqual([
      { user_id: 'user-1', title: 'Optics' },
    ])
  })

  it('refuses a course with no name', async () => {
    const supabase = fakeSupabase()

    await expect(createCourse(supabase, { userId: 'user-1', title: '   ' })).rejects.toThrow(
      /title/i,
    )
    expect(supabase.calls).toHaveLength(0)
  })
})

describe('one course', () => {
  it('answers with its counts, the same shape the list uses', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 'sub-1', title: 'Optics' }, error: null },
      sources: { data: [{ id: 'src-1', subject_id: 'sub-1' }], error: null },
      concepts: { data: [{ id: 'c1', subject_id: 'sub-1', term: 'Refraction' }], error: null },
      concept_mastery: { data: [{ concept_id: 'c1', mastery: '0.95' }], error: null },
    })

    await expect(courseById(supabase, { id: 'sub-1' })).resolves.toEqual({
      id: 'sub-1',
      title: 'Optics',
      sources: 1,
      concepts: 1,
      settled: 1,
    })
  })

  it('answers null for a course that is not there', async () => {
    const supabase = fakeSupabase({ subjects: { data: null, error: null } })

    await expect(courseById(supabase, { id: 'nope' })).resolves.toBeNull()
  })
})
