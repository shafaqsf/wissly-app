// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase, methodsOf } from './fake-supabase.js'
import { createSource, listSources, sectionsForSource } from './sources.js'

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
