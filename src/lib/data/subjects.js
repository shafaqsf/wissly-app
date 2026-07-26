import { unwrap, unwrapList } from './result.js'

/* Subjects are the top level of the library: a learner's material is filed
 * under one, and progress is read per subject.
 *
 * Every function here takes the client rather than making one. The server
 * client is per-request and asynchronous, and a module that reached for it
 * itself could not be tested without standing up a request. */

const COLUMNS = 'id, title, user_id, is_public, created_at, exam_date'

export async function listSubjects(supabase) {
  return unwrapList(
    await supabase.from('subjects').select(COLUMNS).order('created_at', { ascending: false }),
    'list your subjects',
  )
}

export async function createSubject(supabase, { userId, title }) {
  const trimmed = String(title ?? '').trim()

  if (!trimmed) {
    throw new Error('A subject needs a title.')
  }

  return unwrap(
    await supabase
      .from('subjects')
      .insert({ user_id: userId, title: trimmed })
      .select(COLUMNS)
      .single(),
    'create the subject',
  )
}

export async function subjectById(supabase, { id }) {
  return unwrap(
    await supabase.from('subjects').select(COLUMNS).eq('id', id).maybeSingle(),
    'open the subject',
  )
}

/**
 * The subject with this title, or null. Matching is case-insensitive so that
 * adding material to "optics" twice does not produce two subjects that look
 * identical in the sidebar.
 */
export async function subjectByTitle(supabase, { title }) {
  const data = unwrap(
    await supabase
      .from('subjects')
      .select(COLUMNS)
      .ilike('title', String(title ?? '').trim())
      .maybeSingle(),
    'find the subject',
  )

  return data ?? null
}

/** The subject with this title, created if it is not there yet. */
export async function subjectForTitle(supabase, { userId, title }) {
  return (await subjectByTitle(supabase, { title })) ?? createSubject(supabase, { userId, title })
}

/**
 * Make a subject public or private again. Only the owner's row is ever
 * touched — RLS enforces that (`subjects` keeps its owner-only update
 * policy), this is just where the intent to flip it lives in the app.
 */
export async function setSubjectPublic(supabase, { id, isPublic }) {
  return unwrap(
    await supabase
      .from('subjects')
      .update({ is_public: Boolean(isPublic) })
      .eq('id', id)
      .select(COLUMNS)
      .single(),
    'change who can see this course',
  )
}

/**
 * Set or clear a course's exam date, so the countdown, the daily goal and the
 * compressed review plan all have something to plan against. `examDate: null`
 * clears it — a learner may decide not to sit the exam after all, and the
 * course goes back to the default lookahead the daily goal uses without one.
 *
 * Like `setSubjectPublic`, this only ever reaches the owner's row: `subjects`
 * keeps its owner-only `update` policy from 001, and nothing in 015 widens it.
 */
export async function setExamDate(supabase, { id, examDate }) {
  return unwrap(
    await supabase
      .from('subjects')
      .update({ exam_date: examDate || null })
      .eq('id', id)
      .select(COLUMNS)
      .single(),
    'set the exam date',
  )
}
