import { MASTERED_AT } from '../mastery.js'
import { listConceptMastery } from './concepts.js'
import { listSources } from './sources.js'
import { listSubjects } from './subjects.js'

/* A course is a subject seen from the outside: its name, how much material is
 * filed under it, and how much of it has settled. The database has no such
 * table and does not need one — the three reads below are the whole of it.
 *
 * Three queries, not three per course. Asking the database once per subject
 * would be easier to write and would grow with the learner's library, which
 * is the wrong direction for a page that exists to be glanced at.
 */

export async function listCourses(supabase) {
  const [subjects, sources, concepts] = await Promise.all([
    listSubjects(supabase),
    listSources(supabase),
    listConceptMastery(supabase),
  ])

  return subjects.map((subject) => {
    const own = concepts.filter((concept) => concept.subjectId === subject.id)

    return {
      id: subject.id,
      title: subject.title,
      sources: sources.filter((source) => source.subject_id === subject.id).length,
      concepts: own.length,
      settled: own.filter((concept) => concept.mastery >= MASTERED_AT).length,
    }
  })
}
