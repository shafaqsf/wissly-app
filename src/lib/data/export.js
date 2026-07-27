import { FORMATS } from '../agent/formats.js'
import { listArtefacts } from './artefacts.js'
import { listConcepts } from './concepts.js'
import { unwrapList } from './result.js'
import { listSourcesWithSections } from './sources.js'
import { listSubjects, subjectById } from './subjects.js'

/* The bundle export and import agree on.
 *
 * Full fidelity is the whole point of the JSON export, so this gathers
 * everything a course holds rather than what one screen happens to have
 * loaded: sources with their sections, concepts, every artefact — reading and
 * tasks, active and archived — and the review history each artefact earned.
 * `src/lib/export/*` renders this one shape three ways; `src/lib/import/json`
 * reads it back.
 */

const REVIEW_COLUMNS =
  'id, artefact_id, reviewed_at, rating, stability, difficulty, due_at, reps, lapses'

/** One course, or null when it is not there — same shape as an entry of `allDataBundle`. */
export async function courseBundle(supabase, { subjectId }) {
  const subject = await subjectById(supabase, { id: subjectId })
  if (!subject) return null

  return { exported_at: new Date().toISOString(), courses: [await courseFor(supabase, subject)] }
}

/** Every course the learner has. */
export async function allDataBundle(supabase) {
  const subjects = await listSubjects(supabase)
  const courses = []

  // Sequential: a library rarely holds more than a handful of courses, and a
  // failure partway through should name which course it failed on rather
  // than losing that in a Promise.all rejection.
  for (const subject of subjects) {
    courses.push(await courseFor(supabase, subject))
  }

  return { exported_at: new Date().toISOString(), courses }
}

async function courseFor(supabase, subject) {
  const [activeSources, archivedSources, concepts, activeArtefacts, archivedArtefacts] =
    await Promise.all([
      listSourcesWithSections(supabase, { subjectId: subject.id }),
      listSourcesWithSections(supabase, { subjectId: subject.id, archived: true }),
      listConcepts(supabase, { subjectId: subject.id }),
      listArtefacts(supabase, { subjectId: subject.id, formats: FORMATS }),
      listArtefacts(supabase, { subjectId: subject.id, formats: FORMATS, archived: true }),
    ])

  const artefacts = [...activeArtefacts, ...archivedArtefacts]
  const artefactIds = artefacts.map((artefact) => artefact.id)

  const reviews = artefactIds.length
    ? unwrapList(
        await supabase
          .from('reviews')
          .select(REVIEW_COLUMNS)
          .in('artefact_id', artefactIds)
          .order('reviewed_at', { ascending: true }),
        'read the review history',
      )
    : []

  return {
    subject,
    sources: [...activeSources, ...archivedSources],
    concepts,
    artefacts,
    reviews,
  }
}
