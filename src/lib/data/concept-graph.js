import { unwrapList } from './result.js'
import { listConceptMastery } from './concepts.js'
import { linksAmong } from './concept-links.js'

/**
 * The mindmap's nodes and edges for one course.
 *
 * Edges prefer the agent-judged "see also" links from part 1, restricted to
 * the pairs where both ends sit in this course — a link that reaches another
 * course would draw an edge to a node this map never shows, so `linksAmong`
 * filters those out rather than the caller having to.
 *
 * When a course carries none of those yet, the fallback is co-occurrence:
 * every pair of concepts whose sections were cut from the same source. That
 * costs no model call and is available the moment a course has more than one
 * concept, which is what makes it a fallback rather than a second feature —
 * a course that has never run the linker still gets a map.
 */
export async function conceptGraph(supabase, { subjectId }) {
  const concepts = await listConceptMastery(supabase, { subjectId })

  const nodes = concepts.map((concept) => ({
    id: concept.id,
    name: concept.name,
    mastery: concept.mastery,
    subjectId: concept.subjectId,
  }))

  if (nodes.length === 0) return { nodes: [], edges: [] }

  const conceptIds = nodes.map((node) => node.id)
  const links = await linksAmong(supabase, { conceptIds })

  const edges =
    links.length > 0
      ? links.map((link) => ({
          source: link.concept_id,
          target: link.related_concept_id,
          reason: link.reason,
          kind: 'link',
        }))
      : await coOccurrenceEdges(supabase, { conceptIds })

  return { nodes, edges }
}

/** Every pair of concepts, within one course, whose sections share a source. */
async function coOccurrenceEdges(supabase, { conceptIds }) {
  const concepts = unwrapList(
    await supabase.from('concepts').select('id, section_id').in('id', conceptIds),
    'read your concepts',
  )

  const sectionIds = [...new Set(concepts.map((concept) => concept.section_id).filter(Boolean))]
  if (sectionIds.length === 0) return []

  const sections = unwrapList(
    await supabase.from('sections').select('id, source_id').in('id', sectionIds),
    'read your material',
  )
  const sourceBySection = new Map(sections.map((section) => [section.id, section.source_id]))

  const bySource = new Map()
  for (const concept of concepts) {
    const sourceId = sourceBySection.get(concept.section_id)
    if (!sourceId) continue
    if (!bySource.has(sourceId)) bySource.set(sourceId, [])
    bySource.get(sourceId).push(concept.id)
  }

  const edges = []
  for (const ids of bySource.values()) {
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        edges.push({ source: ids[i], target: ids[j], reason: null, kind: 'cooccurrence' })
      }
    }
  }
  return edges
}
