import { unwrapList } from './result.js'

/* Artefacts as the database holds them, and as the renderers want them.
 *
 * The two differ: a row carries `section_id`, the renderers carry the
 * ordinal, the anchor and the passage text, because a citation has to be
 * readable without a second round trip. `toArtefactView` is that translation
 * and the only place it happens. */

const COLUMNS = 'id, subject_id, section_id, concept_id, format, payload, created_at'

/** Read rather than answered: these produce no evidence and are never due. */
export const UNDERSTANDING_FORMATS = ['summary', 'glossary']

/** Answered rather than read: these are what the review queue serves. */
export const RECALL_FORMATS = ['flashcard', 'cloze', 'multiple_choice', 'open_question']

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
    section_ordinal: section?.ordinal ?? null,
    anchor: section?.anchor ?? null,
    passage: section?.content ?? null,
  }
}

export async function saveArtefacts(supabase, { userId, artefacts = [] }) {
  if (artefacts.length === 0) return []

  const rows = artefacts.map((artefact) => ({
    user_id: userId,
    subject_id: artefact.subject_id ?? null,
    section_id: artefact.section_id ?? null,
    concept_id: artefact.concept_id ?? null,
    format: artefact.format,
    payload: artefact.payload,
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
export async function listArtefacts(supabase, { subjectId, formats = UNDERSTANDING_FORMATS } = {}) {
  let query = supabase
    .from('artefacts')
    .select(COLUMNS)
    .in('format', formats)
    .order('created_at', { ascending: false })

  if (subjectId) {
    query = query.eq('subject_id', subjectId)
  }

  const rows = unwrapList(await query, 'read your library')

  return withSections(supabase, rows)
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
