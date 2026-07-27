import { MASTERED_AT } from '../mastery.js'
import { listConceptMastery } from './concepts.js'
import { listSources } from './sources.js'
import { createSubject, listSubjects, subjectById } from './subjects.js'

/* A course is a subject seen from the outside: its name, how much material is
 * filed under it, and how much of it has settled. The database has no such
 * table and does not need one — the three reads below are the whole of it.
 *
 * Three queries, not three per course. Asking the database once per subject
 * would be easier to write and would grow with the learner's library, which
 * is the wrong direction for a page that exists to be glanced at.
 */

/**
 * Create a course.
 *
 * Courses used to appear only as a side effect of adding material, which put
 * the naming of a course inside an upload form and made "start a course, then
 * fill it" impossible to say. This is the same row `subjectForTitle` would
 * have made, made deliberately.
 */
export async function createCourse(supabase, { userId, title }) {
  return createSubject(supabase, { userId, title })
}

/** The counts a course carries, given the concepts and sources that are its. */
function countsFor(subject, sources, concepts) {
  const own = concepts.filter((concept) => concept.subjectId === subject.id)

  return {
    id: subject.id,
    title: subject.title,
    ownerId: subject.user_id,
    isPublic: Boolean(subject.is_public),
    sources: sources.filter((source) => source.subject_id === subject.id).length,
    concepts: own.length,
    settled: own.filter((concept) => concept.mastery >= MASTERED_AT).length,
  }
}

/** One course, in the same shape the list uses, or null. */
export async function courseById(supabase, { id }) {
  const subject = await subjectById(supabase, { id })

  if (!subject) return null

  const [sources, concepts] = await Promise.all([
    listSources(supabase, { subjectId: id }),
    listConceptMastery(supabase, { subjectId: id }),
  ])

  return countsFor(subject, sources, concepts)
}

export async function listCourses(supabase) {
  const [subjects, sources, concepts] = await Promise.all([
    listSubjects(supabase),
    listSources(supabase),
    listConceptMastery(supabase),
  ])

  return subjects.map((subject) => countsFor(subject, sources, concepts))
}
