import { unwrapList } from './result.js'

/* "See also" — a pair of concepts an agent judged related, and why. Stored
 * once per unordered pair (see migrations/007_concept_links.sql), so a
 * caller asking "what does concept X relate to" has to look on both sides of
 * every row: X may have been written as `concept_id` or as
 * `related_concept_id`, depending on which side of the pair happened to be
 * "the course just updated" when the link was made.
 */

const LINK_COLUMNS = 'id, concept_id, related_concept_id, reason'
const CONCEPT_COLUMNS = 'id, term, subject_id'

/** The same key whichever order the two ids arrive in, for deduping a pair. */
export function pairKey(a, b) {
  return [a, b].sort().join('::')
}

/**
 * Every stored link touching any of `ids`, deduped by row id.
 *
 * Two queries rather than one `.or(...)` — building an `or` filter string out
 * of ids means escaping them by hand, and a plain `.in()` on each column does
 * not.
 */
async function linksTouching(supabase, ids) {
  if (ids.length === 0) return []

  const asConcept = unwrapList(
    await supabase.from('concept_links').select(LINK_COLUMNS).in('concept_id', ids),
    'read what is related',
  )
  const asRelated = unwrapList(
    await supabase.from('concept_links').select(LINK_COLUMNS).in('related_concept_id', ids),
    'read what is related',
  )

  const byId = new Map([...asConcept, ...asRelated].map((row) => [row.id, row]))
  return [...byId.values()]
}

/**
 * The "see also" list for each of `conceptIds`, keyed by concept id.
 *
 * One round trip for the links, one for the concepts on the other end of
 * them — a page reading every concept in a course needs this once, not once
 * per row.
 *
 * @returns {Promise<Map<string, Array<{id: string, conceptId: string,
 *   term: string, subjectId: string, reason: string}>>>}
 */
async function seeAlsoBySubject(supabase, { conceptIds }) {
  const result = new Map(conceptIds.map((id) => [id, []]))
  if (conceptIds.length === 0) return result

  const rows = await linksTouching(supabase, conceptIds)
  if (rows.length === 0) return result

  const otherIds = [...new Set(rows.flatMap((row) => [row.concept_id, row.related_concept_id]))]
  const concepts = unwrapList(
    await supabase.from('concepts').select(CONCEPT_COLUMNS).in('id', otherIds),
    'read what is related',
  )
  const byId = new Map(concepts.map((concept) => [concept.id, concept]))

  for (const row of rows) {
    for (const [selfId, otherId] of [
      [row.concept_id, row.related_concept_id],
      [row.related_concept_id, row.concept_id],
    ]) {
      if (!result.has(selfId)) continue
      const other = byId.get(otherId)
      if (!other) continue
      result.get(selfId).push({
        id: row.id,
        conceptId: other.id,
        term: other.term,
        subjectId: other.subject_id,
        reason: row.reason,
      })
    }
  }

  return result
}

/** The "see also" list for one concept. */
export async function listSeeAlso(supabase, { conceptId } = {}) {
  if (!conceptId) return []

  const grouped = await seeAlsoBySubject(supabase, { conceptIds: [conceptId] })
  return grouped.get(conceptId) ?? []
}

/** The "see also" list for every concept in a course, at once. */
export async function seeAlsoForSubject(supabase, { subjectId }) {
  const concepts = unwrapList(
    await supabase.from('concepts').select('id').eq('subject_id', subjectId),
    'read your concepts',
  )

  return seeAlsoBySubject(supabase, { conceptIds: concepts.map((concept) => concept.id) })
}

/** Every pair already linked that touches one of `conceptIds`, as a set of keys. */
export async function existingPairs(supabase, { conceptIds }) {
  const rows = await linksTouching(supabase, conceptIds)
  return new Set(rows.map((row) => pairKey(row.concept_id, row.related_concept_id)))
}

/**
 * The stored links whose *both* ends sit inside `conceptIds` — what the
 * concept map draws as an edge for one course, as opposed to `existingPairs`
 * and `listSeeAlso`, which also surface a link reaching out to another
 * course.
 */
export async function linksAmong(supabase, { conceptIds }) {
  if (conceptIds.length === 0) return []

  const idSet = new Set(conceptIds)
  const rows = unwrapList(
    await supabase.from('concept_links').select(LINK_COLUMNS).in('concept_id', conceptIds),
    'read what is related',
  )

  return rows.filter((row) => idSet.has(row.related_concept_id))
}

/** Write the links an agent judged. */
export async function createConceptLinks(supabase, { userId, links = [] }) {
  if (links.length === 0) return []

  const rows = links.map((link) => ({
    user_id: userId,
    concept_id: link.conceptId,
    related_concept_id: link.relatedConceptId,
    reason: link.reason,
  }))

  return unwrapList(
    await supabase.from('concept_links').insert(rows).select(LINK_COLUMNS),
    'save what is related',
  )
}
