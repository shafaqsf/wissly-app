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
 * Stage 1 is the first six. Stage 2 adds comparison_table and ordering, both
 * generated from one section like the rest. Stage 3 adds practice_exam, which
 * is not generated from a section at all — see the note above its schema.
 * Further formats (free recall, matching, concept map, …) are still
 * deliberately absent; adding one means adding its schema here first.
 */

/** The blank marker in a cloze. One per cloze, chosen for being unmistakable. */
export const CLOZE_BLANK = '____'

/** Every format, in the order the database enumerates them. */
export const FORMATS = Object.freeze([
  'summary',
  'glossary',
  'flashcard',
  'cloze',
  'multiple_choice',
  'open_question',
  'comparison_table',
  'ordering',
  'practice_exam',
])

/* Reading and tasks — the split the four areas are built on.
 *
 * It is derived, not a column. `format` already says everything needed, and a
 * second column saying the same thing is a second thing to keep true. The
 * database agrees: `artefact_schedule` in 004 enumerates the same four recall
 * formats in its `where`, and 003 counts evidence only from those.
 *
 * Reading is processed material — read, never answered, so it produces no
 * evidence, has no due date and lives beside the source on the course page.
 * Tasks are asked of the learner, run through FSRS and live in Tasks.
 */

/**
 * Read, not answered. No evidence, no schedule, no mastery.
 *
 * `comparison_table` sits here rather than with the recall formats because
 * the feature-set design groups it under "Understanding" alongside summary
 * and glossary, not under "Recall" — see
 * docs/superpowers/specs/2026-07-24-wissly-feature-set-design.md. A grid of
 * cells is something to study, the same way a summary is; nothing about it
 * asks the learner to produce an answer that could be marked right or wrong.
 */
export const READING_FORMATS = Object.freeze(['summary', 'glossary', 'comparison_table'])

/** Answered. These and only these run through FSRS and feed mastery. */
export const TASK_FORMATS = Object.freeze([
  'flashcard',
  'cloze',
  'multiple_choice',
  'open_question',
  'ordering',
  'practice_exam',
])

/** @returns {'reading'|'task'|null} null for anything not in the catalogue. */
export function formatKind(format) {
  if (READING_FORMATS.includes(format)) return 'reading'
  if (TASK_FORMATS.includes(format)) return 'task'
  return null
}

export function isReadingFormat(format) {
  return formatKind(format) === 'reading'
}

export function isTaskFormat(format) {
  return formatKind(format) === 'task'
}

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

  /**
   * Two to four things, compared across a shared set of dimensions. `cells`
   * is a flat list rather than a nested grid because JSON Schema cannot
   * express "one entry per (item, dimension) pair" — `CROSS_CHECKS` does,
   * checking every index is in range and the grid has no gap and no
   * duplicate. Read, not answered; see the note on `READING_FORMATS`.
   */
  comparison_table: {
    type: 'object',
    additionalProperties: false,
    required: ['items', 'dimensions', 'cells'],
    properties: {
      items: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: string('one thing being compared, as the source names it'),
        description: 'what is being compared',
      },
      dimensions: {
        type: 'array',
        minItems: 2,
        maxItems: 5,
        items: string('one axis the items are compared on'),
        description: 'what they are compared by',
      },
      cells: {
        type: 'array',
        minItems: 4,
        maxItems: 20,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['item_index', 'dimension_index', 'value', 'rationale'],
          properties: {
            item_index: {
              type: 'integer',
              minimum: 0,
              description: 'zero-based index into items',
            },
            dimension_index: {
              type: 'integer',
              minimum: 0,
              description: 'zero-based index into dimensions',
            },
            value: string('the cell itself, as short as it can be while staying complete'),
            rationale: string('why this cell is true, one sentence'),
          },
        },
        description:
          'one cell per (item, dimension) pair — items.length × dimensions.length of them',
      },
    },
  },

  /**
   * A set of steps or items, stored in their correct order. The UI shuffles
   * a copy for the learner and grades their arrangement against this one, so
   * the payload itself carries no separate "shuffled" field.
   */
  ordering: {
    type: 'object',
    additionalProperties: false,
    required: ['prompt', 'items', 'rationale'],
    properties: {
      prompt: string('what the learner is asked to put in order'),
      items: {
        type: 'array',
        minItems: 3,
        maxItems: 8,
        items: string('one step or item, given in its correct order'),
        description: 'the correct order — the UI shuffles a copy for the learner',
      },
      rationale: string('why this order is correct'),
    },
  },

  /**
   * A mini test assembled from artefacts that already exist, rather than new
   * content of its own — the design doc calls it "mixed formats, timed,
   * scored", and the only honest way to mix formats without inventing a
   * second copy of each question is to reference the first one. `items`
   * therefore carries an `artefact_id`, not a question.
   *
   * This is why practice_exam is never produced by `chooseFormat` or
   * `generateArtefact` in src/lib/agent/artefacts.js: a model asked to fill
   * this schema from one section's text would have to invent artefact ids,
   * and an invented id is worse than an honest failure. It is composed
   * instead — by the `compose_practice_exam` tool in
   * src/lib/agent/write-tools.js, which reads the referenced artefacts back
   * to confirm they exist and are answerable before writing this row — or
   * written by hand through `write_artefact`, the same as any other format.
   *
   * It is still a task format: completing the exam is itself an event FSRS
   * can schedule, independent of the schedules the referenced artefacts
   * already keep on their own.
   */
  practice_exam: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'instructions', 'time_limit_minutes', 'items'],
    properties: {
      title: string('what this exam is called'),
      instructions: string('what the learner is asked to do, and how it is scored'),
      time_limit_minutes: {
        type: 'integer',
        minimum: 1,
        maximum: 180,
        description: 'how long the learner has, in minutes',
      },
      items: {
        type: 'array',
        minItems: 2,
        maxItems: 20,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['artefact_id', 'format'],
          properties: {
            artefact_id: string('the id of the existing task this item asks'),
            format: {
              type: 'string',
              // Every answerable format except practice_exam itself — an
              // exam cannot contain another exam.
              enum: TASK_FORMATS.filter((format) => format !== 'practice_exam'),
              description: 'the format of the referenced artefact',
            },
          },
        },
        description: 'the questions this exam draws from, each an existing task artefact',
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

/**
 * The result of grading a teach-back explanation: the learner explains a
 * concept in their own words, with nothing pre-written to grade it against —
 * unlike `GRADE_SCHEMA`, which grades an answer against a `model_answer` and
 * `criteria` the artefact already carries. Here the model has to read the
 * concept's own source material and judge freshly, which is why every point
 * it makes has to name the section it checked that point against: a verdict
 * that cannot say where it came from is a guess wearing a grade.
 *
 * Not an artefact format — never stored in `artefacts` — but model output,
 * so it needs a schema all the same.
 */
const gradedPoint = (description) => ({
  type: 'object',
  additionalProperties: false,
  required: ['point', 'section_id'],
  properties: {
    point: string(description),
    section_id: string('the id of the section this point was checked against'),
  },
})

export const TEACH_BACK_GRADE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['covered', 'gaps', 'wrong', 'feedback'],
  properties: {
    covered: {
      type: 'array',
      maxItems: 10,
      items: gradedPoint('one thing the explanation got right, in the learner’s own words'),
      description: 'what the explanation correctly covered',
    },
    gaps: {
      type: 'array',
      maxItems: 10,
      items: gradedPoint('one thing the source covers that the explanation left out'),
      description: 'depth the explanation missed entirely',
    },
    wrong: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['claim', 'section_id', 'correction'],
        properties: {
          claim: string('what the learner said that the source contradicts'),
          section_id: string('the id of the section that contradicts it'),
          correction: string('what the source actually says'),
        },
      },
      description: 'what was actively wrong, not merely missing',
    },
    feedback: string('two or three sentences addressed to the learner, no praise'),
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
  comparison_table(payload, errors) {
    const { items, dimensions, cells } = payload
    if (!Array.isArray(items) || !Array.isArray(dimensions) || !Array.isArray(cells)) return

    const expected = items.length * dimensions.length
    if (cells.length !== expected) {
      errors.push(`cells: expected one per (item, dimension) pair (${expected}), got ${cells.length}`)
      return
    }

    const seen = new Set()
    cells.forEach((cell, index) => {
      const { item_index: itemIndex, dimension_index: dimensionIndex } = cell ?? {}
      if (Number.isInteger(itemIndex) && (itemIndex < 0 || itemIndex >= items.length)) {
        errors.push(
          `cells[${index}].item_index: expected an index into items (0..${items.length - 1}), got ${itemIndex}`,
        )
      }
      if (
        Number.isInteger(dimensionIndex) &&
        (dimensionIndex < 0 || dimensionIndex >= dimensions.length)
      ) {
        errors.push(
          `cells[${index}].dimension_index: expected an index into dimensions (0..${dimensions.length - 1}), got ${dimensionIndex}`,
        )
      }
      const key = `${itemIndex},${dimensionIndex}`
      if (seen.has(key)) {
        errors.push(`cells[${index}]: duplicate cell for item ${itemIndex}, dimension ${dimensionIndex}`)
      }
      seen.add(key)
    })
  },
  ordering(payload, errors) {
    const { items } = payload
    if (!Array.isArray(items)) return

    const distinct = new Set(items.map((item) => String(item).trim().toLowerCase()))
    if (distinct.size !== items.length) {
      errors.push('items: expected distinct items')
    }
  },
  practice_exam(payload, errors) {
    const { items } = payload
    if (!Array.isArray(items)) return

    const seen = new Set()
    items.forEach((item, index) => {
      const id = item?.artefact_id
      if (typeof id !== 'string') return
      if (seen.has(id)) {
        errors.push(`items[${index}].artefact_id: duplicate reference to ${id}`)
      }
      seen.add(id)
    })
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
