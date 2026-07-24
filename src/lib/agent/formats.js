import { validate } from './schema.js'

/**
 * The artefact formats, and the shape of the `payload` each one stores.
 *
 * The catalogue is fixed. An agent chooses *which* format a section deserves,
 * but never invents a new one, because every format has a schema here and a
 * renderer in the UI. These names are the `format` column of the `artefacts`
 * table and these objects are its `payload` jsonb — the schema and the UI both
 * read from this file, so there is one definition rather than three.
 *
 * Stage 2 and 3 formats (comparison table, ordering, free recall, …) are
 * deliberately absent; adding one means adding its schema here first.
 */

/** The blank marker in a cloze. One per cloze, chosen for being unmistakable. */
export const CLOZE_BLANK = '____'

/** Stage 1 formats, in the order the database enumerates them. */
export const FORMATS = Object.freeze([
  'summary',
  'glossary',
  'flashcard',
  'cloze',
  'multiple_choice',
  'open_question',
])

const string = (description) => ({ type: 'string', minLength: 1, description })

export const PAYLOAD_SCHEMAS = Object.freeze({
  /** Layered summary: three sentences, a paragraph, then full depth. */
  summary: {
    type: 'object',
    additionalProperties: false,
    required: ['three_sentences', 'paragraph', 'full'],
    properties: {
      three_sentences: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: string('one sentence of the shortest layer'),
        description: 'the whole section in exactly three sentences',
      },
      paragraph: string('the section in one paragraph'),
      full: string('the section at full depth, keeping every claim'),
    },
  },

  /** One entry of a glossary. The anchor lives on the artefact, not here. */
  glossary: {
    type: 'object',
    additionalProperties: false,
    required: ['term', 'definition'],
    properties: {
      term: string('the term as the source writes it'),
      definition: string('a self-contained definition, one or two sentences'),
    },
  },

  flashcard: {
    type: 'object',
    additionalProperties: false,
    required: ['front', 'back'],
    properties: {
      front: string('the prompt — a question or a term'),
      back: string('the answer, as short as it can be while staying complete'),
    },
  },

  cloze: {
    type: 'object',
    additionalProperties: false,
    required: ['text', 'answer'],
    properties: {
      text: string(`a sentence with exactly one term replaced by ${CLOZE_BLANK}`),
      answer: string('the term that was removed, verbatim'),
    },
  },

  multiple_choice: {
    type: 'object',
    additionalProperties: false,
    required: ['stem', 'options', 'answer_index', 'rationales'],
    properties: {
      stem: string('the question'),
      options: {
        type: 'array',
        minItems: 2,
        maxItems: 6,
        items: string('one option'),
        description: 'the options, all plausible, none a giveaway',
      },
      answer_index: {
        type: 'integer',
        minimum: 0,
        description: 'zero-based index into options of the correct one',
      },
      rationales: {
        type: 'array',
        minItems: 2,
        maxItems: 6,
        items: string('why this option is right or wrong'),
        description: 'one rationale per option, in the same order',
      },
    },
  },

  open_question: {
    type: 'object',
    additionalProperties: false,
    required: ['prompt', 'model_answer', 'criteria'],
    properties: {
      prompt: string('the question, answerable in a few sentences'),
      model_answer: string('an answer that would score full marks'),
      criteria: {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        items: string('one thing the answer must contain'),
        description: 'what a correct answer has to mention, one point each',
      },
    },
  },
})

/**
 * The result of grading a learner's free-text answer. Not an artefact format —
 * it is never stored in `artefacts` — but it is model output and so needs a
 * schema all the same.
 */
export const GRADE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'score', 'missing', 'feedback'],
  properties: {
    verdict: {
      type: 'string',
      enum: ['correct', 'partial', 'incorrect'],
      description: 'the overall judgement',
    },
    score: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'fraction of the criteria the answer met',
    },
    missing: {
      type: 'array',
      maxItems: 8,
      items: string('one thing the answer failed to say'),
      description: 'what was missing, quoting the criterion it belongs to',
    },
    feedback: string('two sentences addressed to the learner, no praise'),
  },
})

/** @param {unknown} format */
export function isFormat(format) {
  return FORMATS.includes(format)
}

/**
 * Rules a JSON Schema cannot state: relations between two properties. Every
 * one of these is a way a plausible-looking payload would still be unusable in
 * the UI.
 */
const CROSS_CHECKS = {
  cloze(payload, errors) {
    if (typeof payload.text !== 'string') return
    const blanks = payload.text.split(CLOZE_BLANK).length - 1
    if (blanks === 0) {
      errors.push(`text: expected the blank marker ${CLOZE_BLANK}`)
    } else if (blanks > 1) {
      errors.push(`text: expected exactly one blank, found ${blanks}`)
    }
  },
  multiple_choice(payload, errors) {
    const { options, answer_index: answerIndex, rationales } = payload
    if (!Array.isArray(options)) return
    if (
      Number.isInteger(answerIndex) &&
      (answerIndex < 0 || answerIndex >= options.length)
    ) {
      errors.push(
        `answer_index: expected an index into options (0..${options.length - 1}), got ${answerIndex}`,
      )
    }
    if (Array.isArray(rationales) && rationales.length !== options.length) {
      errors.push(
        `rationales: expected one per option (${options.length}), got ${rationales.length}`,
      )
    }
    const distinct = new Set(options.map((option) => String(option).trim().toLowerCase()))
    if (distinct.size !== options.length) {
      errors.push('options: expected distinct options')
    }
  },
}

/**
 * Validate a payload against its format.
 *
 * @param {string} format
 * @param {unknown} payload
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePayload(format, payload) {
  const schema = PAYLOAD_SCHEMAS[format]
  if (!schema) {
    return { valid: false, errors: [`: unknown artefact format "${format}"`] }
  }

  const { errors } = validate(payload, schema)
  if (errors.length === 0) CROSS_CHECKS[format]?.(payload, errors)

  return { valid: errors.length === 0, errors }
}
