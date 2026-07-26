// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase, methodsOf } from './fake-supabase.js'
import { importCourse, listPublicCourses } from './library.js'

/** Every `insert(...)` call made against one table, across every chain. */
function insertsFor(supabase, table) {
  return supabase
    .queries(table)
    .filter((call) => methodsOf(call).includes('insert'))
    .map((call) => argsOf(call, 'insert')[0])
}

describe('browsing the public library', () => {
  it('lists public courses, newest first', async () => {
    const supabase = fakeSupabase({
      subjects: {
        data: [{ id: 'sub-1', title: 'Optics', user_id: 'owner-1', created_at: '2026-02-01' }],
        error: null,
      },
    })

    const courses = await listPublicCourses(supabase)

    expect(courses).toEqual([
      { id: 'sub-1', title: 'Optics', user_id: 'owner-1', created_at: '2026-02-01' },
    ])
    expect(argsOf(supabase.query('subjects'), 'eq')).toEqual(['is_public', true])
    expect(argsOf(supabase.query('subjects'), 'order')).toEqual([
      'created_at',
      { ascending: false },
    ])
  })

  it('reads no public courses as an empty library, not as a failure', async () => {
    const supabase = fakeSupabase({ subjects: { data: null, error: null } })

    await expect(listPublicCourses(supabase)).resolves.toEqual([])
  })
})

describe('importing a public course', () => {
  function stock() {
    return fakeSupabase({
      subjects: [
        { data: { id: 'pub-1', title: 'Optics', user_id: 'owner-1' }, error: null },
        { data: { id: 'new-1', title: 'Optics' }, error: null },
      ],
      sources: [
        { data: [{ id: 'src-1', kind: 'text', title: 'Lecture', raw_text: 'Light bends.' }], error: null },
        { data: { id: 'new-src-1' }, error: null },
      ],
      sections: [
        {
          data: [{ id: 'sec-1', ordinal: 1, content: 'Light bends at a boundary.', anchor: { page: 1 } }],
          error: null,
        },
        { data: { id: 'new-sec-1' }, error: null },
      ],
      concepts: [
        { data: [{ id: 'c-1', term: 'Refraction', definition: 'Bending of light.', section_id: 'sec-1' }], error: null },
        { data: { id: 'new-c-1' }, error: null },
      ],
      artefacts: [
        {
          data: [
            {
              id: 'a-1',
              section_id: 'sec-1',
              concept_id: 'c-1',
              format: 'glossary',
              payload: { term: 'Refraction', definition: 'Bending of light.' },
            },
          ],
          error: null,
        },
        { data: { id: 'new-a-1' }, error: null },
      ],
    })
  }

  it('creates a new subject owned by the importer, named after the original', async () => {
    const supabase = stock()

    const imported = await importCourse(supabase, { subjectId: 'pub-1', userId: 'user-2' })

    expect(imported).toEqual({ id: 'new-1', title: 'Optics' })
    expect(insertsFor(supabase, 'subjects')).toEqual([{ user_id: 'user-2', title: 'Optics' }])
  })

  it('copies every source and section under the new subject', async () => {
    const supabase = stock()

    await importCourse(supabase, { subjectId: 'pub-1', userId: 'user-2' })

    expect(insertsFor(supabase, 'sources')).toEqual([
      {
        user_id: 'user-2',
        subject_id: 'new-1',
        kind: 'text',
        title: 'Lecture',
        raw_text: 'Light bends.',
      },
    ])
    expect(insertsFor(supabase, 'sections')).toEqual([
      {
        user_id: 'user-2',
        source_id: 'new-src-1',
        ordinal: 1,
        content: 'Light bends at a boundary.',
        anchor: { page: 1 },
      },
    ])
  })

  it('copies concepts and artefacts, remapping their section and concept ids to the copies', async () => {
    const supabase = stock()

    await importCourse(supabase, { subjectId: 'pub-1', userId: 'user-2' })

    expect(insertsFor(supabase, 'concepts')).toEqual([
      {
        user_id: 'user-2',
        subject_id: 'new-1',
        term: 'Refraction',
        definition: 'Bending of light.',
        section_id: 'new-sec-1',
      },
    ])
    expect(insertsFor(supabase, 'artefacts')).toEqual([
      {
        user_id: 'user-2',
        subject_id: 'new-1',
        section_id: 'new-sec-1',
        concept_id: 'new-c-1',
        format: 'glossary',
        payload: { term: 'Refraction', definition: 'Bending of light.' },
        origin: 'manual',
      },
    ])
  })

  it('only reads unarchived material to copy', async () => {
    const supabase = stock()

    await importCourse(supabase, { subjectId: 'pub-1', userId: 'user-2' })

    expect(argsOf(supabase.queries('sources')[0], 'is')).toEqual(['archived_at', null])
    expect(argsOf(supabase.queries('artefacts')[0], 'is')).toEqual(['archived_at', null])
  })

  it('refuses to import a course that is not public', async () => {
    const supabase = fakeSupabase({ subjects: { data: null, error: null } })

    await expect(
      importCourse(supabase, { subjectId: 'private-1', userId: 'user-2' }),
    ).rejects.toThrow(/not.*public|not found/i)
  })
})
