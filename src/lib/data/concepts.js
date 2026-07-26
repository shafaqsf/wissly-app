import { MASTERED_AT } from '../mastery.js'
import { unwrap, unwrapList } from './result.js'

/* A concept is a named idea a learner is trying to hold. It is the unit
 * progress is measured in, because "how much of this subject do you know" is
 * only answerable one idea at a time.
 *
 * Stage 1 names one concept per section. That is coarser than the feature
 * set intends — a section can hold two ideas — but it is honest: it is the
 * finest grain the ingestion layer actually produces, and inventing a
 * subdivision the source does not have would put words in its mouth. */

const COLUMNS = 'id, subject_id, term, definition, section_id'

/** The longest a concept name may be before it stops reading as a name. */
const NAME_LIMIT = 60

/**
 * What to call the idea in a section. A heading is the author's own name for
 * it and is always preferred; failing that, the opening sentence, cut at a
 * word boundary so the name never ends mid-word.
 */
export function conceptNameFor(section) {
  const heading = section?.anchor?.heading

  if (heading) return String(heading).trim().slice(0, NAME_LIMIT)

  const text = String(section?.content ?? '').trim()
  const firstSentence = text.split(/(?<=[.!?])\s/)[0] ?? text

  if (firstSentence.length <= NAME_LIMIT) return firstSentence

  const cut = firstSentence.slice(0, NAME_LIMIT)
  return `${cut.slice(0, cut.lastIndexOf(' ')).trim()}…`
}

/** One concept per section, written in the same order the sections came in. */
export async function createConceptsForSections(supabase, { userId, subjectId, sections = [] }) {
  if (sections.length === 0) return []

  const rows = sections.map((section) => ({
    user_id: userId,
    subject_id: subjectId,
    term: conceptNameFor(section),
    section_id: section.id,
  }))

  return unwrapList(
    await supabase.from('concepts').insert(rows).select(COLUMNS),
    'name what the material covers',
  )
}

export async function listConcepts(supabase, { subjectId } = {}) {
  let query = supabase.from('concepts').select(COLUMNS)

  if (subjectId) {
    query = query.eq('subject_id', subjectId)
  }

  return unwrapList(await query, 'list what you are learning')
}

/**
 * Concepts with their mastery, ready for the grain field.
 *
 * The mastery view carries no term — a view has no foreign key, so PostgREST
 * will not embed the concept row into it — so the two are read separately and
 * joined here. A concept the view has not scored yet is untouched, which is
 * mastery 0, not a missing row.
 *
 * The course each concept belongs to comes along, so a caller reading every
 * concept at once can group them without a second query per course.
 */
export async function listConceptMastery(supabase, { subjectId } = {}) {
  const concepts = await listConcepts(supabase, { subjectId })

  if (concepts.length === 0) return []

  const scores = unwrapList(
    await supabase.from('concept_mastery').select('concept_id, mastery'),
    'read your progress',
  )

  const byConcept = new Map(scores.map((row) => [row.concept_id, Number(row.mastery) || 0]))

  return concepts.map((concept) => ({
    id: concept.id,
    subjectId: concept.subject_id,
    name: concept.term,
    mastery: byConcept.get(concept.id) ?? 0,
  }))
}

/**
 * The concepts furthest from mastered, ranked worst first.
 *
 * Deliberately wider than the gap report (`gapConcepts` in agent-runs.js),
 * which only names a concept that has been answered and answered wrongly.
 * This includes a concept nobody has touched at all — mastery 0 either
 * way — because "where should I look next" is a bigger question than "what
 * have I gotten wrong so far", and a learner staring at an empty gap report
 * still needs to know where the material itself is thin.
 */
export async function weakestConcepts(supabase, { subjectId, limit = 10 } = {}) {
  const concepts = await listConceptMastery(supabase, { subjectId })

  return [...concepts]
    .filter((concept) => concept.mastery < MASTERED_AT)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, limit)
}

export async function conceptById(supabase, { id }) {
  return unwrap(
    await supabase.from('concepts').select(COLUMNS).eq('id', id).maybeSingle(),
    'read the concept',
  )
}

/** Beyond this a relatedness prompt is paying to compare concepts nobody asked about. */
const CANDIDATE_LIMIT = 60

/**
 * Every concept elsewhere in the library — the raw material
 * `suggestConceptLinks` judges relatedness over. Term, definition and the
 * course it belongs to, which is what the reason in a "see also" link needs
 * to name.
 *
 * Capped and most-recent-first rather than exhaustive: a library that has
 * grown past a few dozen courses does not need every concept it has ever
 * held compared, every time one course asks to be linked.
 */
export async function candidateConcepts(supabase, { excludeIds = [], limit = CANDIDATE_LIMIT } = {}) {
  let query = supabase
    .from('concepts')
    .select('id, term, definition, subject_id')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const concepts = unwrapList(await query, 'read the rest of your library')
  if (concepts.length === 0) return []

  const subjectIds = [...new Set(concepts.map((concept) => concept.subject_id))]
  const subjects = unwrapList(
    await supabase.from('subjects').select('id, title').in('id', subjectIds),
    'read the rest of your library',
  )
  const titleById = new Map(subjects.map((subject) => [subject.id, subject.title]))

  return concepts.map((concept) => ({
    id: concept.id,
    term: concept.term,
    definition: concept.definition,
    subjectId: concept.subject_id,
    courseTitle: titleById.get(concept.subject_id),
  }))
}
