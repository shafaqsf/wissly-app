// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, argsOfAll, fakeSupabase, methodsOf } from './fake-supabase.js'
import {
  archiveSource,
  createSource,
  listSources,
  listSourcesWithSections,
  restoreSource,
  sectionsForSource,
} from './sources.js'

const section = (ordinal, content, anchor) => ({ ordinal, content, anchor })

describe('storing a source', () => {
  it('writes the source and its sections together', async () => {
    const supabase = fakeSupabase({
      sources: { data: { id: 'src-1', title: 'Optics notes' }, error: null },
      sections: { data: [{ id: 'sec-1', ordinal: 1 }], error: null },
    })

    const result = await createSource(supabase, {
      userId: 'user-1',
      subjectId: 'sub-1',
      kind: 'text',
      title: 'Optics notes',
      rawText: 'Light bends.',
      sections: [section(1, 'Light bends.', { start: 0, end: 12 })],
    })

    expect(result.source).toEqual({ id: 'src-1', title: 'Optics notes' })
    expect(result.sections).toEqual([{ id: 'sec-1', ordinal: 1 }])

    expect(argsOf(supabase.query('sections'), 'insert')).toEqual([
      [
        {
          user_id: 'user-1',
          source_id: 'src-1',
          ordinal: 1,
          content: 'Light bends.',
          anchor: { start: 0, end: 12 },
        },
      ],
    ])
  })

  it('stamps the owner on every section, not only on the source', async () => {
    const supabase = fakeSupabase({
      sources: { data: { id: 'src-1' }, error: null },
      sections: { data: [{ id: 'sec-1' }, { id: 'sec-2' }], error: null },
    })

    await createSource(supabase, {
      userId: 'user-1',
      subjectId: 'sub-1',
      kind: 'pdf',
      title: 'Script',
      sections: [section(1, 'One', { page: 1 }), section(2, 'Two', { page: 2 })],
    })

    const [rows] = argsOf(supabase.query('sections'), 'insert')
    expect(rows.every((row) => row.user_id === 'user-1')).toBe(true)
  })

  it('refuses a source with nothing readable in it', async () => {
    const supabase = fakeSupabase()

    await expect(
      createSource(supabase, { userId: 'user-1', subjectId: 'sub-1', kind: 'pdf', sections: [] }),
    ).rejects.toThrow(/no readable text/i)
    expect(supabase.calls).toHaveLength(0)
  })

  it('takes the source back out when its sections fail to land', async () => {
    const supabase = fakeSupabase({
      sources: [
        { data: { id: 'src-1' }, error: null },
        { data: null, error: null },
      ],
      sections: { data: null, error: { message: 'value too long' } },
    })

    await expect(
      createSource(supabase, {
        userId: 'user-1',
        subjectId: 'sub-1',
        kind: 'text',
        sections: [section(1, 'One')],
      }),
    ).rejects.toThrow('value too long')

    // A source with no sections cites nothing and generates nothing. Better
    // absent than a ghost in the library.
    const [insert, remove] = supabase.queries('sources')
    expect(methodsOf(insert)).toContain('insert')
    expect(methodsOf(remove)).toContain('delete')
    expect(argsOf(remove, 'eq')).toEqual(['id', 'src-1'])
  })

  it('defaults to not generated — the ordinary path is real material', async () => {
    const supabase = fakeSupabase({
      sources: { data: { id: 'src-1' }, error: null },
      sections: { data: [{ id: 'sec-1' }], error: null },
    })

    await createSource(supabase, {
      userId: 'user-1',
      subjectId: 'sub-1',
      kind: 'text',
      title: 'Notes',
      sections: [section(1, 'One')],
    })

    const [row] = argsOf(supabase.query('sources'), 'insert')
    expect(row.generated).toBe(false)
  })

  it('marks a source drafted from the goal-course pipeline as generated', async () => {
    const supabase = fakeSupabase({
      sources: { data: { id: 'src-1' }, error: null },
      sections: { data: [{ id: 'sec-1' }], error: null },
    })

    await createSource(supabase, {
      userId: 'user-1',
      subjectId: 'sub-1',
      kind: 'text',
      title: 'Drafted course',
      sections: [section(1, 'One', { generated: true })],
      generated: true,
    })

    const [row] = argsOf(supabase.query('sources'), 'insert')
    expect(row.generated).toBe(true)
  })

  it('falls back to a title rather than storing a blank one', async () => {
    const supabase = fakeSupabase({
      sources: { data: { id: 'src-1' }, error: null },
      sections: { data: [{ id: 'sec-1' }], error: null },
    })

    await createSource(supabase, {
      userId: 'user-1',
      subjectId: 'sub-1',
      kind: 'text',
      title: '   ',
      sections: [section(1, 'One')],
    })

    const [row] = argsOf(supabase.query('sources'), 'insert')
    expect(row.title).toBe('Untitled')
  })
})

describe('reading material back', () => {
  it('lists a subject\'s sources newest first', async () => {
    const supabase = fakeSupabase({ sources: { data: [{ id: 'src-1' }], error: null } })

    await listSources(supabase, { subjectId: 'sub-1' })

    const call = supabase.query('sources')
    expect(argsOf(call, 'eq')).toEqual(['subject_id', 'sub-1'])
    expect(argsOf(call, 'order')).toEqual(['created_at', { ascending: false }])
  })

  it('lists everything when no subject is named', async () => {
    const supabase = fakeSupabase({ sources: { data: [], error: null } })

    await listSources(supabase)

    expect(methodsOf(supabase.query('sources'))).not.toContain('eq')
  })

  it('returns sections in the order they were read, not the order they were stored', async () => {
    const supabase = fakeSupabase({ sections: { data: [], error: null } })

    await sectionsForSource(supabase, { sourceId: 'src-1' })

    expect(argsOf(supabase.query('sections'), 'order')).toEqual([
      'ordinal',
      { ascending: true },
    ])
  })
})

describe('the archive', () => {
  it('leaves archived sources out of the shelf by default', async () => {
    const supabase = fakeSupabase({ sources: { data: [], error: null } })

    await listSources(supabase, { subjectId: 'sub-1' })

    expect(argsOf(supabase.query('sources'), 'is')).toEqual(['archived_at', null])
  })

  it('shows only the archived ones when the archive is asked for', async () => {
    const supabase = fakeSupabase({ sources: { data: [], error: null } })

    await listSources(supabase, { subjectId: 'sub-1', archived: true })

    const call = supabase.query('sources')
    expect(methodsOf(call)).not.toContain('is')
    expect(argsOf(call, 'not')).toEqual(['archived_at', 'is', null])
  })

  it('archives by writing a timestamp, never by deleting', async () => {
    const supabase = fakeSupabase({ sources: { data: { id: 'src-1' }, error: null } })
    const now = () => new Date('2026-07-25T09:00:00.000Z')

    await archiveSource(supabase, { id: 'src-1', now })

    const call = supabase.query('sources')
    expect(methodsOf(call)).not.toContain('delete')
    expect(argsOf(call, 'update')).toEqual([{ archived_at: '2026-07-25T09:00:00.000Z' }])
    expect(argsOf(call, 'eq')).toEqual(['id', 'src-1'])
  })

  it('restores by clearing it', async () => {
    const supabase = fakeSupabase({ sources: { data: { id: 'src-1' }, error: null } })

    await restoreSource(supabase, { id: 'src-1' })

    expect(argsOf(supabase.query('sources'), 'update')).toEqual([{ archived_at: null }])
  })
})

describe('a course shelf', () => {
  it('reads every source and every section in two queries, not one per source', async () => {
    const supabase = fakeSupabase({
      sources: {
        data: [
          { id: 'src-1', title: 'Notes' },
          { id: 'src-2', title: 'Script' },
        ],
        error: null,
      },
      sections: {
        data: [
          { id: 'sec-1', source_id: 'src-1', ordinal: 1, content: 'One.', anchor: {} },
          { id: 'sec-2', source_id: 'src-2', ordinal: 1, content: 'Two.', anchor: {} },
          { id: 'sec-3', source_id: 'src-1', ordinal: 2, content: 'Three.', anchor: {} },
        ],
        error: null,
      },
    })

    const shelf = await listSourcesWithSections(supabase, { subjectId: 'sub-1' })

    expect(supabase.calls).toHaveLength(2)
    expect(argsOf(supabase.query('sections'), 'in')).toEqual(['source_id', ['src-1', 'src-2']])
    expect(shelf.map((source) => source.sections.map((section) => section.id))).toEqual([
      ['sec-1', 'sec-3'],
      ['sec-2'],
    ])
  })

  it('gives a source with no sections an empty shelf rather than nothing', async () => {
    const supabase = fakeSupabase({
      sources: { data: [{ id: 'src-1' }], error: null },
      sections: { data: [], error: null },
    })

    const [source] = await listSourcesWithSections(supabase, { subjectId: 'sub-1' })
    expect(source.sections).toEqual([])
  })

  it('asks the database nothing more when there are no sources', async () => {
    const supabase = fakeSupabase({ sources: { data: [], error: null } })

    await expect(listSourcesWithSections(supabase, { subjectId: 'sub-1' })).resolves.toEqual([])
    expect(supabase.query('sections')).toBeUndefined()
  })
})
