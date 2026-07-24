import { generateArtefacts } from '@/lib/agent/artefacts.js'
import { ingestSource } from '@/lib/agent/ingest.js'
import { saveArtefacts } from '@/lib/data/artefacts.js'
import { createConceptsForSections } from '@/lib/data/concepts.js'
import { createSource } from '@/lib/data/sources.js'
import { subjectForTitle } from '@/lib/data/subjects.js'

/* The one path from "here is my material" to "here is something to answer".
 *
 * It is a plain function taking its collaborators rather than a server
 * action, so the whole sequence can be tested without a request, a database
 * or a language model. The action next door is the thin wrapper that fetches
 * those three and calls this. */

/** More sections than this in one go is a bill, not a study session. */
export const SECTION_LIMIT = 12

/**
 * @param {object} params
 * @param {object} params.supabase
 * @param {object} params.client an OpenRouter client
 * @param {string} params.userId
 * @param {{subject: string, title: string, kind: 'text'|'pdf', text?: string,
 *   data?: Uint8Array}} params.material
 * @returns {Promise<{subject: object, source: object, sections: object[],
 *   artefacts: object[], skipped: number}>}
 */
export async function addMaterial({ supabase, client, userId, material }) {
  const { subject: subjectTitle, title, kind, text, data } = material

  const sections = await ingestSource({ kind, text, data })

  if (sections.length === 0) {
    throw new Error('There was no readable text in that. Check the file and try again.')
  }

  const subject = await subjectForTitle(supabase, { userId, title: subjectTitle })

  const stored = await createSource(supabase, {
    userId,
    subjectId: subject.id,
    kind,
    title,
    rawText: kind === 'text' ? text : null,
    sections,
  })

  const concepts = await createConceptsForSections(supabase, {
    userId,
    subjectId: subject.id,
    sections: stored.sections,
  })

  const conceptBySection = new Map(
    concepts.map((concept) => [concept.section_id, concept.id]),
  )

  // Each section costs a model call. Beyond the limit the rest are stored but
  // not generated from, and the caller is told how many — a silent truncation
  // would read as "we covered everything".
  const generateFrom = stored.sections.slice(0, SECTION_LIMIT)
  const skipped = stored.sections.length - generateFrom.length

  const { artefacts: generated, failures } = await generateArtefacts({
    client,
    sections: generateFrom,
    subjectId: subject.id,
    collectFailures: true,
  })

  const artefacts = await saveArtefacts(supabase, {
    userId,
    artefacts: generated.map((artefact) => ({
      ...artefact,
      concept_id: conceptBySection.get(artefact.section_id) ?? null,
    })),
  })

  return { subject, source: stored.source, sections: stored.sections, artefacts, skipped, failures }
}
