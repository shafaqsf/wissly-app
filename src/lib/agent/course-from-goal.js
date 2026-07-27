import 'server-only'

/**
 * Autonomous course-build from a stated goal.
 *
 * Every other section in this product is cut from something the learner
 * brought — pasted text, a PDF page — and its anchor points back at that
 * exact place. Here there is no material yet: the learner states a goal
 * ("I want to understand X for exam Y") and the model drafts an outline from
 * its own knowledge, before any upload happens.
 *
 * That is a different kind of claim than everything else this product makes,
 * and the one thing it must never do is pretend otherwise. A drafted section
 * gets an anchor too — `{generated: true}` rather than `{page}` or
 * `{start, end}` — so it goes through the exact same storage, concept and
 * artefact pipeline as material-based ingestion (`generateArtefact`,
 * `createConceptsForSections`, `saveArtefacts` are the same functions,
 * unmodified) while remaining honestly distinguishable at the one place that
 * matters: the anchor a citation is built from. `describeAnchor` in
 * `src/components/artefact/anchor.js` reads that shape and says so in words
 * rather than showing a page number that does not exist.
 */

const OUTLINE_SYSTEM_PROMPT = [
  'You draft an initial course outline for wissly from a learner\'s stated',
  'goal, using your own knowledge — there is no source material yet. Write a',
  'short, plain course title and a small number of parts that build on each',
  'other in a sensible teaching order. Each part needs a heading naming what',
  'it covers and a few paragraphs of real content a learner could study from',
  '— not a description of what the part will contain, the content itself.',
  'Be honest about the limits of what you know: do not invent statistics,',
  'named studies or quotations you are not confident of. Write in the',
  'language the goal was stated in.',
].join(' ')

/** More than this from one goal is a syllabus, not a first batch. */
export const DEFAULT_MAX_GOAL_SECTIONS = 8

const string = (description) => ({ type: 'string', minLength: 1, description })

function outlineSchema(maxSections) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'sections'],
    properties: {
      title: string('a short, plain title for this course'),
      sections: {
        type: 'array',
        minItems: 1,
        maxItems: maxSections,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['heading', 'content'],
          properties: {
            heading: string('what this part covers'),
            content: string('the material itself, written from your own knowledge'),
          },
        },
        description: 'one entry per part, in the order a learner should study them',
      },
    },
  }
}

/**
 * Draft an outline for a stated learning goal. One model call, no database.
 *
 * @param {object} params
 * @param {object} params.client
 * @param {string} params.goal what the learner said they want to learn
 * @param {number} [params.maxSections]
 * @returns {Promise<{title: string, sections: Array<{heading: string, content: string}>}>}
 */
export async function draftCourseOutline({
  client,
  goal,
  maxSections = DEFAULT_MAX_GOAL_SECTIONS,
  ...params
}) {
  const trimmed = String(goal ?? '').trim()
  if (trimmed === '') {
    throw new Error('Say what you want to learn, and this drafts a course for it.')
  }

  return client.chatStructured({
    ...params,
    schemaName: 'course_outline',
    schema: outlineSchema(maxSections),
    messages: [
      { role: 'system', content: OUTLINE_SYSTEM_PROMPT },
      { role: 'user', content: `Learning goal: ${trimmed}` },
    ],
  })
}

/**
 * The anchor a drafted section carries: honestly not a real source. Read by
 * `describeAnchor` in the UI, which is the one place this shape actually has
 * to be told apart from a page or a character range.
 */
export function generatedAnchor(heading) {
  return { generated: true, ...(heading ? { heading: String(heading).trim() } : {}) }
}

/**
 * Turn a drafted outline into section rows, in the same shape
 * `sectionsFromText` and `sectionsFromPdf` produce — ordinal, content, anchor
 * — so `createSource` cannot tell the difference and needs no second code
 * path.
 *
 * @param {{sections: Array<{heading: string, content: string}>}} outline
 * @returns {Array<{ordinal: number, content: string, anchor: {generated: true, heading?: string}}>}
 */
export function sectionsFromOutline(outline) {
  return (outline?.sections ?? []).map((section, index) => ({
    ordinal: index + 1,
    content: section.content,
    anchor: generatedAnchor(section.heading),
  }))
}
