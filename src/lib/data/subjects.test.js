// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import { createSubject, listSubjects, setExamDate, subjectByTitle } from './subjects.js'

describe('listing subjects', () => {
  it('returns them newest first', async () => {
    const supabase = fakeSupabase({
      subjects: { data: [{ id: 's1', title: 'Linear algebra' }], error: null },
    })

    const subjects = await listSubjects(supabase)

    expect(subjects).toEqual([{ id: 's1', title: 'Linear algebra' }])
    expect(argsOf(supabase.query('subjects'), 'order')).toEqual([
      'created_at',
      { ascending: false },
    ])
  })

  it('reads no rows as no subjects, not as a failure', async () => {
    const supabase = fakeSupabase({ subjects: { data: null, error: null } })

    await expect(listSubjects(supabase)).resolves.toEqual([])
  })

  it('raises what the database said rather than returning nothing', async () => {
    const supabase = fakeSupabase({
      subjects: { data: null, error: { message: 'permission denied' } },
    })

    await expect(listSubjects(supabase)).rejects.toThrow('permission denied')
  })
})

describe('creating a subject', () => {
  it('stamps the owner, because row level security has nothing to check without it', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 's1', title: 'Optics' }, error: null },
    })

    const subject = await createSubject(supabase, {
      userId: 'user-1',
      title: 'Optics',
    })

    expect(subject).toEqual({ id: 's1', title: 'Optics' })
    expect(argsOf(supabase.query('subjects'), 'insert')).toEqual([
      { user_id: 'user-1', title: 'Optics' },
    ])
  })

  it('refuses a blank title instead of storing one', async () => {
    const supabase = fakeSupabase()

    await expect(
      createSubject(supabase, { userId: 'user-1', title: '   ' }),
    ).rejects.toThrow(/title/i)
    expect(supabase.calls).toHaveLength(0)
  })

  it('trims the title, so two subjects do not differ by a space', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 's1', title: 'Optics' }, error: null },
    })

    await createSubject(supabase, { userId: 'user-1', title: '  Optics  ' })

    expect(argsOf(supabase.query('subjects'), 'insert')).toEqual([
      { user_id: 'user-1', title: 'Optics' },
    ])
  })
})

describe('finding a subject by title', () => {
  it('matches case-insensitively, so "Optics" and "optics" are one subject', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 's1', title: 'Optics' }, error: null },
    })

    const subject = await subjectByTitle(supabase, { title: 'optics' })

    expect(subject).toEqual({ id: 's1', title: 'Optics' })
    expect(argsOf(supabase.query('subjects'), 'ilike')).toEqual(['title', 'optics'])
  })

  it('returns null when there is none, which is not an error', async () => {
    const supabase = fakeSupabase({ subjects: { data: null, error: null } })

    await expect(subjectByTitle(supabase, { title: 'Optics' })).resolves.toBeNull()
  })
})

describe('setting an exam date', () => {
  it('writes the date onto the course', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 's1', title: 'Optics', exam_date: '2026-09-01' }, error: null },
    })

    const subject = await setExamDate(supabase, { id: 's1', examDate: '2026-09-01' })

    expect(subject).toEqual({ id: 's1', title: 'Optics', exam_date: '2026-09-01' })
    expect(argsOf(supabase.query('subjects'), 'update')).toEqual([{ exam_date: '2026-09-01' }])
    expect(argsOf(supabase.query('subjects'), 'eq')).toEqual(['id', 's1'])
  })

  it('clears the date rather than storing an empty string', async () => {
    const supabase = fakeSupabase({
      subjects: { data: { id: 's1', title: 'Optics', exam_date: null }, error: null },
    })

    await setExamDate(supabase, { id: 's1', examDate: '' })

    expect(argsOf(supabase.query('subjects'), 'update')).toEqual([{ exam_date: null }])
  })
})
