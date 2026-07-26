import { ingestSource } from '@/lib/agent/ingest.js'
import { createConceptsForSections } from '@/lib/data/concepts.js'
import { createSource } from '@/lib/data/sources.js'
import { subjectForTitle } from '@/lib/data/subjects.js'

/* The one path from "here is my material" to "it is filed".
 *
 * It stops there, deliberately. This function used to call the model up to
 * twelve times on upload and decide, without asking, that section 3 deserved
 * a flashcard — the behaviour the four-areas redesign exists to remove.
 * Generating is now a thing the learner asks for, on the type's own surface,
 * with the number of model calls shown before the click.
 *
 * So there is no model call here for what used to cost up to twelve — with
 * one deliberate exception. A photo of handwriting has no text underneath it
 * to ingest instead of generating from, the way a PDF or a slide deck does:
 * transcribing it *is* ingestion, the same role `unpdf` plays for a PDF, and
 * it is the one place `client` below is ever actually used. Explaining a
 * diagram on an image-heavy PDF page is the same kind of call, but it is
 * never made unless `material.explainImages` says so — a PDF upload costs
 * nothing by default, exactly as it always has.
 *
 * Adding material ingests, creates the source, its sections and its
 * concepts, and returns. It is a plain function taking its collaborators
 * rather than a server action, so the whole sequence can be tested without a
 * request and without a database.
 */

/**
 * @param {object} params
 * @param {object} params.supabase
 * @param {string} params.userId
 * @param {{subject: string, title: string,
 *   kind: 'text'|'pdf'|'pptx'|'url'|'image', text?: string, data?: Uint8Array,
 *   origin?: string, mimeType?: string, explainImages?: boolean}} params.material
 * @param {object} [params.client] a vision-capable OpenRouter client — required
 *   for `kind: 'image'`, used for `kind: 'pdf'` only when `explainImages` is true
 * @returns {Promise<{subject: object, source: object, sections: object[],
 *   concepts: object[]}>}
 */
export async function addMaterial({ supabase, userId, material, client }) {
  const { subject: subjectTitle, title, kind, text, data, origin, mimeType, explainImages } =
    material

  const sections = await ingestSource({ kind, text, data, client, explainImages, mimeType })

  if (sections.length === 0) {
    throw new Error('There was no readable text in that. Check the file and try again.')
  }

  const subject = await subjectForTitle(supabase, { userId, title: subjectTitle })

  const stored = await createSource(supabase, {
    userId,
    subjectId: subject.id,
    kind,
    title,
    rawText: kind === 'text' || kind === 'url' ? text : null,
    origin: origin ?? null,
    sections,
  })

  const concepts = await createConceptsForSections(supabase, {
    userId,
    subjectId: subject.id,
    sections: stored.sections,
  })

  return { subject, source: stored.source, sections: stored.sections, concepts }
}
