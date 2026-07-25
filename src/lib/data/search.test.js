// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase, methodsOf } from './fake-supabase.js'
import { SEARCH_KINDS, search } from './search.js'

const hit = {
  kind: 'section',
  id: 'sec-1',
  subject_id: 'sub-1',
  parent_id: 'src-1',
  title: 'Optics notes · 3',
  snippet: 'Light bends at a boundary.',
  created_at: '2026-07-01T00:00:00.000Z',
}

describe('searching', () => {
  it('asks the one view rather than five tables', async () => {
    const supabase = fakeSupabase({ search_index: { data: [hit], error: null } })

    await search(supabase, { query: 'refraction' })

    expect(supabase.query('search_index')).toBeDefined()
    expect(supabase.calls).toHaveLength(1)
  })

  it('reads the hit as the interface wants it', async () => {
    const supabase = fakeSupabase({ search_index: { data: [hit], error: null } })

    await expect(search(supabase, { query: 'refraction' })).resolves.toEqual([
      {
        kind: 'section',
        id: 'sec-1',
        subjectId: 'sub-1',
        parentId: 'src-1',
        title: 'Optics notes · 3',
        snippet: 'Light bends at a boundary.',
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ])
  })

  it('uses websearch syntax, so quotes and minus mean what the learner thinks', async () => {
    const supabase = fakeSupabase({ search_index: { data: [], error: null } })

    await search(supabase, { query: '"snell law" -optics' })

    expect(argsOf(supabase.query('search_index'), 'textSearch')).toEqual([
      'document',
      '"snell law" -optics',
      { type: 'websearch', config: 'english' },
    ])
  })

  it('scopes to a course and to a kind when asked', async () => {
    const supabase = fakeSupabase({ search_index: { data: [], error: null } })

    await search(supabase, { query: 'snell', subjectId: 'sub-1', kinds: ['concept'] })

    const call = supabase.query('search_index')
    expect(argsOf(call, 'eq')).toEqual(['subject_id', 'sub-1'])
    expect(argsOf(call, 'in')).toEqual(['kind', ['concept']])
  })

  it('refuses a kind that is not searchable rather than returning nothing', async () => {
    const supabase = fakeSupabase()

    await expect(search(supabase, { query: 'snell', kinds: ['lesson'] })).rejects.toThrow(/lesson/)
    expect(supabase.calls).toHaveLength(0)
  })

  it('does not go to the database for an empty query', async () => {
    const supabase = fakeSupabase()

    await expect(search(supabase, { query: '   ' })).resolves.toEqual([])
    expect(supabase.calls).toHaveLength(0)
  })

  it('bounds what comes back — a reflex must not pull the whole library', async () => {
    const supabase = fakeSupabase({ search_index: { data: [], error: null } })

    await search(supabase, { query: 'snell' })

    expect(methodsOf(supabase.query('search_index'))).toContain('limit')
  })

  it('names the five things that are searchable', () => {
    expect(SEARCH_KINDS).toEqual([
      'source',
      'section',
      'concept',
      'artefact',
      'conversation',
    ])
  })
})
