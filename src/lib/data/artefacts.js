import { READING_FORMATS, TASK_FORMATS, isFormat } from '../agent/formats.js'
import { unwrap, unwrapList } from './result.js'

/* Artefacts as the database holds them, and as the renderers want them.
 *
 * The two differ: a row carries `section_id`, the renderers carry the
 * ordinal, the anchor and the passage text, because a citation has to be
 * readable without a second round trip. `toArtefactView` is that translation
 * and the only place it happens. */

const COLUMNS =
  'id, subject_id, section_id, concept_id, format, payload, origin, archived_at, created_at'

/* The split itself lives in `src/lib/agent/formats.js`, beside the catalogue
 * it partitions — five other surfaces import it from there. These two names
 * are the data layer's older words for the same two lists, kept because they
 * read better next to a query. */

/** Read rather than answered: these produce no evidence and are never due. */
export const UNDERSTANDING_FORMATS = READING_FORMATS

/** Answered rather than read: these are what the review queue serves. */
export const RECALL_FORMATS = TASK_FORMATS

const ORIGINS = new Set(['manual', 'agent'])

/**
 * One row, plus the section it came from, as the renderers expect it.
 * The section is optional — an artefact whose section was re-ingested keeps
 * working, it just cannot show the passage.
 */
export function toArtefactView(row, section) {
  return {
    id: row.id,
    subject_id: row.subject_id ?? null,
    section_id: row.section_id ?? null,
    concept_id: row.concept_id ?? null,
    format: row.format,
    payload: row.payload,
    // Where the card came from, so the interface can say so rather than guess.
    origin: row.origin ?? 'manual',
    archived_at: row.archived_at ?? null,
    section_ordinal: section?.ordinal ?? null,
    anchor: section?.anchor ?? null,
    passage: section?.content ?? null,
  }
}

/**
 * Store a batch. This is the generation path, so `origin` defaults to the
 * agent — a card the learner typed comes through `createArtefact`.
 */
export async function saveArtefacts(supabase, { userId, artefacts = [], origin = 'agent' }) {
  if (artefacts.length === 0) return []

  if (!ORIGINS.has(origin)) {
    throw new Error(`"${origin}" is not an origin. There are two: manual and agent.`)
  }

  const rows = artefacts.map((artefact) => ({
    user_id: userId,
    subject_id: artefact.subject_id ?? null,
    section_id: artefact.section_id ?? null,
    concept_id: artefact.concept_id ?? null,
    format: artefact.format,
    payload: artefact.payload,
    origin,
  }))

  return unwrapList(
    await supabase.from('artefacts').insert(rows).select(COLUMNS),
    'store what was generated',
  )
}

/**
 * Artefacts with their passages attached.
 *
 * The sections come in a second query rather than an embed. PostgREST can
 * embed across a foreign key, which is fine here but not in the schedule
 * view next door, and having one shape of read is worth more than saving a
 * round trip on a list this size.
 */
export async function listArtefacts(
  supabase,
  { subjectId, sourceId, sectionId, formats = UNDERSTANDING_FORMATS, archived = false } = {},
) {
  // An artefact names a section, never a source. Filtering by source is
  // therefore two queries, and the first one has to happen before the second
  // can be built — an empty source is an answer, not an unfiltered read.
  let sectionIds = null
  if (sourceId) {
    const sections = await sectionIdsForSource(supabase, { sourceId })
    if (sections.length === 0) return []
    sectionIds = sections
  }

  let query = supabase.from('artefacts').select(COLUMNS).in('format', formats)

  if (subjectId) query = query.eq('subject_id', subjectId)
  if (sectionId) query = query.eq('section_id', sectionId)
  if (sectionIds) query = query.in('section_id', sectionIds)

  query = archived
    ? query.not('archived_at', 'is', null)
    : query.is('archived_at', null)

  const rows = unwrapList(
    await query.order('created_at', { ascending: false }),
    'read your library',
  )

  return withSections(supabase, rows)
}

async function sectionIdsForSource(supabase, { sourceId }) {
  const sections = unwrapList(
    await supabase.from('sections').select('id').eq('source_id', sourceId),
    'read the source',
  )

  return sections.map((section) => section.id)
}

/**
 * Write one artefact.
 *
 * `origin` is the whole reason this is not `saveArtefacts` with a list of
 * one: the interface has to be able to say whether the learner wrote this
 * card or the agent did, and a column that defaults silently would make
 * everything look hand-written.
 */
export async function createArtefact(
  supabase,
  { userId, subjectId, sectionId = null, conceptId = null, format, payload, origin = 'manual' },
) {
  if (!isFormat(format)) {
    throw new Error(`"${format}" is not an artefact format.`)
  }
  if (!ORIGINS.has(origin)) {
    throw new Error(`"${origin}" is not an origin. There are two: manual and agent.`)
  }

  return unwrap(
    await supabase
      .from('artefacts')
      .insert({
        user_id: userId,
        subject_id: subjectId,
        section_id: sectionId,
        concept_id: conceptId,
        format,
        payload,
        origin,
      })
      .select(COLUMNS)
      .single(),
    'store the card',
  )
}

/** Edit one. Only what was passed is written; `format` is not editable here. */
export async function updateArtefact(supabase, { id, payload, conceptId, sectionId }) {
  const patch = {
    ...(payload === undefined ? {} : { payload }),
    ...(conceptId === undefined ? {} : { concept_id: conceptId }),
    ...(sectionId === undefined ? {} : { section_id: sectionId }),
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('That edit changes nothing.')
  }

  return unwrap(
    await supabase.from('artefacts').update(patch).eq('id', id).select(COLUMNS).single(),
    'save the card',
  )
}

export async function archiveArtefact(supabase, { id, now = () => new Date() }) {
  return unwrap(
    await supabase
      .from('artefacts')
      .update({ archived_at: now().toISOString() })
      .eq('id', id)
      .select(COLUMNS)
      .single(),
    'archive the card',
  )
}

export async function restoreArtefact(supabase, { id }) {
  return unwrap(
    await supabase
      .from('artefacts')
      .update({ archived_at: null })
      .eq('id', id)
      .select(COLUMNS)
      .single(),
    'restore the card',
  )
}

/* Bulk actions.
 *
 * Selection in the workbench is multi-row and survives a filter change, so
 * every one of these takes a list and issues one statement. A loop would be
 * one round trip per row and, worse, would half-apply on a failure. */

export async function archiveArtefacts(supabase, { ids = [], now = () => new Date() }) {
  if (ids.length === 0) return []

  return unwrapList(
    await supabase
      .from('artefacts')
      .update({ archived_at: now().toISOString() })
      .in('id', ids)
      .select(COLUMNS),
    'archive what you selected',
  )
}

export async function restoreArtefacts(supabase, { ids = [] }) {
  if (ids.length === 0) return []

  return unwrapList(
    await supabase.from('artefacts').update({ archived_at: null }).in('id', ids).select(COLUMNS),
    'restore what you selected',
  )
}

/** Move a selection to another course. The sections they cite do not move. */
export async function moveArtefacts(supabase, { ids = [], subjectId }) {
  if (ids.length === 0) return []

  return unwrapList(
    await supabase
      .from('artefacts')
      .update({ subject_id: subjectId })
      .in('id', ids)
      .select(COLUMNS),
    'move what you selected',
  )
}

/**
 * Push a selection out to a new due date.
 *
 * `reviews` is an event log and the current FSRS state of an artefact is its
 * most recent row, so rescheduling moves that row's `due_at` and leaves the
 * history alone. Writing a new review row instead would invent a grading that
 * never happened and would move mastery.
 *
 * An artefact with no review has no state to move. It is already due now,
 * which is the earliest anything can be, so it is simply not in the answer.
 */
export async function rescheduleArtefacts(supabase, { ids = [], dueAt }) {
  if (ids.length === 0) return []

  const reviews = unwrapList(
    await supabase
      .from('reviews')
      .select('id, artefact_id, reviewed_at')
      .in('artefact_id', ids)
      .order('reviewed_at', { ascending: false }),
    'read the schedule',
  )

  const latest = new Map()
  for (const review of reviews) {
    if (!latest.has(review.artefact_id)) latest.set(review.artefact_id, review.id)
  }

  const reviewIds = [...latest.values()]
  if (reviewIds.length === 0) return []

  const stamp = dueAt instanceof Date ? dueAt.toISOString() : String(dueAt)

  return unwrapList(
    await supabase
      .from('reviews')
      .update({ due_at: stamp })
      .in('id', reviewIds)
      .select('id, artefact_id, due_at'),
    'reschedule what you selected',
  )
}

/**
 * Which of these sections already have an artefact of this format.
 *
 * Duplicate protection, asked before generating rather than after: manual and
 * agent creation reach the same sections, and the surface shows what is
 * already covered before the click that spends the model calls.
 *
 * Archived artefacts do not count. An archived card is a card the learner
 * threw away, and it must not stand in the way of making another one.
 */
export async function sectionsWithFormat(supabase, { format, sectionIds, subjectId } = {}) {
  const named = Array.isArray(sectionIds) ? sectionIds : null

  if (named?.length === 0) return []
  if (!named && !subjectId) return []

  let query = supabase.from('artefacts').select('section_id').eq('format', format)

  if (subjectId) query = query.eq('subject_id', subjectId)
  if (named) query = query.in('section_id', named)

  const rows = unwrapList(await query.is('archived_at', null), 'check what already exists')

  return [...new Set(rows.map((row) => row.section_id).filter(Boolean))]
}

/** Attach each row's section, in one query for the whole batch. */
export async function withSections(supabase, rows) {
  const ids = [...new Set(rows.map((row) => row.section_id).filter(Boolean))]

  if (ids.length === 0) {
    return rows.map((row) => toArtefactView(row))
  }

  const sections = unwrapList(
    await supabase.from('sections').select('id, ordinal, content, anchor').in('id', ids),
    'read the sources',
  )

  const bySection = new Map(sections.map((section) => [section.id, section]))

  return rows.map((row) => toArtefactView(row, bySection.get(row.section_id)))
}
