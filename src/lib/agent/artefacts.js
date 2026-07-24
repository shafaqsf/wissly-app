import 'server-only'

import {
  CLOZE_BLANK,
  FORMATS,
  GRADE_SCHEMA,
  PAYLOAD_SCHEMAS,
  validatePayload,
} from './formats.js'

/**
 * Artefact generation — sections in, artefacts out.
 *
 * Two decisions are made per section: **which** format it deserves, and
 * **what** that format's payload says. The first is a judgement (a definition
 * wants a flashcard, a contrast wants a comparison), so an agent makes it. The
 * second is constrained by the format's schema, so the model has very little
 * room to be creative in the wrong direction.
 *
 * Every artefact returned here names the section it came from — `section_id`,
 * `section_ordinal` and the section's `anchor`. That is not decoration: the
 * product promises that any generated claim can be traced back to the page it
 * came from, and an artefact that has lost its section cannot keep it.
 *
 * The returned object is shaped like a row of the `artefacts` table
 * (`subject_id`, `section_id`, `concept_id`, `format`, `payload`) plus the two
 * read-only fields the UI needs to render the anchor. Writing the row is
 * somebody else's job; this module never touches the database.
 */

const SYSTEM_PROMPT = [
  'You turn study material into learning artefacts for wissly.',
  'Work only from the section you are given. Never introduce a fact that is not',
  'in it, and never soften a claim the source makes. If the section is too thin',
  'to support the format you were asked for, produce the thinnest honest version',
  'rather than inventing material. Write in the language of the source.',
  'Reply with JSON only.',
].join(' ')

const CHOOSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['format', 'reason'],
  properties: {
    format: {
      type: 'string',
      enum: [...FORMATS],
      description: 'the format this section deserves',
    },
    reason: {
      type: 'string',
      minLength: 1,
      description: 'one sentence on why, naming what the section is',
    },
  },
}

const FORMAT_GUIDANCE = [
  '- summary: the section is exposition that has to be understood before it can be recalled.',
  '- glossary: the section defines a named term.',
  '- flashcard: the section holds one fact worth recalling on cue.',
  `- cloze: one term carries the section, and the sentence still reads with it replaced by ${CLOZE_BLANK}.`,
  '- multiple_choice: the section invites a confusion worth confronting, so the distractors can be reasoned.',
  '- open_question: the section asks for an explanation that a single term would not prove.',
].join('\n')

/** The section as the model sees it, anchor included so citations stay honest. */
function sectionBlock(section) {
  const anchor = section.anchor ? ` (anchor: ${JSON.stringify(section.anchor)})` : ''
  return `Section ${section.ordinal}${anchor}:\n"""\n${section.content}\n"""`
}

/**
 * Decide which format a section deserves.
 *
 * @param {{client: object, section: object, model?: string, signal?: AbortSignal}} params
 * @returns {Promise<{format: string, reason: string}>}
 */
export async function chooseFormat({ client, section, ...params }) {
  const choice = await client.chatStructured({
    ...params,
    schemaName: 'format_choice',
    schema: CHOOSE_SCHEMA,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          'Choose the one format that serves this section best.',
          '',
          FORMAT_GUIDANCE,
          '',
          sectionBlock(section),
        ].join('\n'),
      },
    ],
  })

  if (!PAYLOAD_SCHEMAS[choice?.format]) {
    throw new TypeError(`unknown artefact format "${choice?.format}"`)
  }
  return choice
}

/**
 * Generate one artefact from one section.
 *
 * @param {object} params
 * @param {object} params.client an OpenRouter client
 * @param {object} params.section a section, with `id`, `ordinal`, `content`, `anchor`
 * @param {string} [params.format] omit to let the agent choose
 * @param {string} [params.subjectId]
 * @param {string} [params.conceptId]
 * @returns {Promise<{subject_id: string|null, section_id: string|null,
 *   concept_id: string|null, format: string, payload: object,
 *   section_ordinal: number, anchor: object|null}>}
 */
export async function generateArtefact({
  client,
  section,
  format,
  subjectId = null,
  conceptId = null,
  ...params
}) {
  const chosen = format ?? (await chooseFormat({ client, section, ...params })).format

  const schema = PAYLOAD_SCHEMAS[chosen]
  if (!schema) throw new TypeError(`unknown artefact format "${chosen}"`)

  const payload = await client.chatStructured({
    ...params,
    schemaName: chosen,
    schema,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          `Write one ${chosen} artefact from this section.`,
          ...(chosen === 'cloze'
            ? [`Mask exactly one term, writing it as ${CLOZE_BLANK}.`]
            : []),
          '',
          sectionBlock(section),
        ].join('\n'),
      },
    ],
  })

  // `chatStructured` has already checked the schema; this catches the rules a
  // schema cannot state — a cloze with no blank, a rationale per option.
  const { valid, errors } = validatePayload(chosen, payload)
  if (!valid) {
    throw new TypeError(`generated ${chosen} is unusable: ${errors.join('; ')}`)
  }

  return {
    subject_id: subjectId,
    section_id: section.id ?? null,
    concept_id: conceptId,
    format: chosen,
    payload,
    section_ordinal: section.ordinal,
    anchor: section.anchor ?? null,
  }
}

/**
 * Generate an artefact for each of a list of sections, in order.
 *
 * A long document will always contain a section the model cannot do anything
 * with. `collectFailures` decides whether that loses the whole run or only that
 * section — batch ingestion wants the second, an interactive single-section
 * request wants the first.
 *
 * @param {object} params
 * @param {object} params.client
 * @param {Array<object>} params.sections
 * @param {string} [params.format] fix the format instead of choosing per section
 * @param {boolean} [params.collectFailures=false]
 * @returns {Promise<Array<object>|{artefacts: Array<object>,
 *   failures: Array<{section_id: string, error: string}>}>}
 */
export async function generateArtefacts({
  client,
  sections,
  format,
  collectFailures = false,
  ...params
}) {
  const artefacts = []
  const failures = []

  // Sequential on purpose: artefact quality does not benefit from concurrency,
  // and a rate limit hit once is cheaper than the same limit hit fifty times.
  for (const section of sections) {
    try {
      artefacts.push(await generateArtefact({ client, section, format, ...params }))
    } catch (error) {
      if (!collectFailures) throw error
      failures.push({ section_id: section.id ?? null, error: error.message })
    }
  }

  return collectFailures ? { artefacts, failures } : artefacts
}

/**
 * Grade a learner's free-text answer against the source, and say what was
 * missing rather than only whether it was right.
 *
 * @param {object} params
 * @param {object} params.client
 * @param {{prompt: string, model_answer: string, criteria: string[]}} params.question
 * @param {string} params.answer what the learner wrote
 * @param {object} [params.section] the section the question came from
 * @returns {Promise<{verdict: 'correct'|'partial'|'incorrect', score: number,
 *   missing: string[], feedback: string}>}
 */
export async function gradeAnswer({ client, question, answer, section, ...params }) {
  if (typeof answer !== 'string' || answer.trim() === '') {
    throw new TypeError('answer is empty — there is nothing to grade')
  }

  const grade = await client.chatStructured({
    ...params,
    schemaName: 'grade',
    schema: GRADE_SCHEMA,
    messages: [
      {
        role: 'system',
        content: [
          SYSTEM_PROMPT,
          'You are grading. Be exact and unsentimental: name what is missing,',
          'do not praise, and do not credit a point the learner did not make.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Question:\n${question.prompt}`,
          '',
          `A full-marks answer:\n${question.model_answer}`,
          '',
          `Criteria, one point each:\n${(question.criteria ?? [])
            .map((criterion) => `- ${criterion}`)
            .join('\n')}`,
          ...(section ? ['', `The source it came from:\n${sectionBlock(section)}`] : []),
          '',
          `The learner's answer:\n"""\n${answer.trim()}\n"""`,
        ].join('\n'),
      },
    ],
  })

  // A grade that disagrees with itself would be rendered as two contradictory
  // claims in the UI, so it is worth failing over.
  const missing = grade.missing.length
  if (grade.verdict === 'correct' && missing > 0) {
    throw new TypeError(
      `verdict "correct" contradicts ${missing} missing point${missing === 1 ? '' : 's'}`,
    )
  }
  if (grade.verdict === 'incorrect' && missing === 0) {
    throw new TypeError('verdict "incorrect" contradicts nothing being missing')
  }

  return grade
}
