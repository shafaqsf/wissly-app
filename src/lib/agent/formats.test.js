// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  FORMATS,
  PAYLOAD_SCHEMAS,
  READING_FORMATS,
  TASK_FORMATS,
  formatKind,
  isFormat,
  isReadingFormat,
  isTaskFormat,
  validatePayload,
} from './formats.js'

describe('FORMATS', () => {
  it('is exactly the stage 1 catalogue, in the order the database enumerates it', () => {
    expect(FORMATS).toEqual([
      'summary',
      'glossary',
      'flashcard',
      'cloze',
      'multiple_choice',
      'open_question',
    ])
  })

  it('has a payload schema for every format and no schema without a format', () => {
    expect(Object.keys(PAYLOAD_SCHEMAS).sort()).toEqual([...FORMATS].sort())
  })

  it('recognises a format name', () => {
    expect(isFormat('cloze')).toBe(true)
    expect(isFormat('comparison_table')).toBe(false)
    expect(isFormat(undefined)).toBe(false)
  })
})

describe('PAYLOAD_SCHEMAS', () => {
  it('closes every object, so a model cannot smuggle extra keys past us', () => {
    for (const schema of Object.values(PAYLOAD_SCHEMAS)) {
      expect(schema.type).toBe('object')
      expect(schema.additionalProperties).toBe(false)
      expect(schema.required.sort()).toEqual(Object.keys(schema.properties).sort())
    }
  })
})

describe('validatePayload — summary', () => {
  const good = {
    three_sentences: ['One.', 'Two.', 'Three.'],
    paragraph: 'A paragraph.',
    full: 'The whole thing.',
  }

  it('accepts the three layers', () => {
    expect(validatePayload('summary', good).valid).toBe(true)
  })

  it('insists on exactly three sentences, since the UI renders three', () => {
    expect(validatePayload('summary', { ...good, three_sentences: ['One.'] }).valid).toBe(
      false,
    )
    expect(
      validatePayload('summary', {
        ...good,
        three_sentences: ['One.', 'Two.', 'Three.', 'Four.'],
      }).valid,
    ).toBe(false)
  })

  it('rejects an empty layer', () => {
    expect(validatePayload('summary', { ...good, paragraph: '' }).valid).toBe(false)
  })
})

describe('validatePayload — glossary', () => {
  it('accepts a term and its definition', () => {
    expect(validatePayload('glossary', { term: 'Monad', definition: 'A monoid.' }).valid).toBe(
      true,
    )
  })

  it('rejects a definition-free term', () => {
    expect(validatePayload('glossary', { term: 'Monad' }).errors).toEqual([
      ': missing required property "definition"',
    ])
  })
})

describe('validatePayload — flashcard', () => {
  it('accepts a front and a back', () => {
    expect(validatePayload('flashcard', { front: 'Q', back: 'A' }).valid).toBe(true)
  })

  it('rejects an empty side', () => {
    expect(validatePayload('flashcard', { front: '', back: 'A' }).valid).toBe(false)
  })
})

describe('validatePayload — cloze', () => {
  it('accepts masked text with its answer', () => {
    expect(
      validatePayload('cloze', {
        text: 'A monad is a monoid in the category of ____.',
        answer: 'endofunctors',
      }).valid,
    ).toBe(true)
  })

  it('rejects text that masks nothing, because there is nothing to recall', () => {
    const result = validatePayload('cloze', {
      text: 'A monad is a monoid.',
      answer: 'endofunctors',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['text: expected the blank marker ____'])
  })

  it('rejects text with more than one blank, since stage 1 masks one term', () => {
    const result = validatePayload('cloze', {
      text: '____ is a monoid in the category of ____.',
      answer: 'A monad',
    })
    expect(result.errors).toEqual(['text: expected exactly one blank, found 2'])
  })
})

describe('validatePayload — multiple_choice', () => {
  const good = {
    stem: 'What is a monad?',
    options: ['A monoid', 'A functor', 'A pointer', 'A burrito'],
    answer_index: 0,
    rationales: ['Right.', 'Weaker.', 'Unrelated.', 'A joke.'],
  }

  it('accepts a stem, options, the answer index and a reason each', () => {
    expect(validatePayload('multiple_choice', good).valid).toBe(true)
  })

  it('insists on at least two options', () => {
    expect(
      validatePayload('multiple_choice', {
        ...good,
        options: ['Only one'],
        rationales: ['Right.'],
        answer_index: 0,
      }).valid,
    ).toBe(false)
  })

  it('rejects an answer index that points past the options', () => {
    const result = validatePayload('multiple_choice', { ...good, answer_index: 4 })
    expect(result.errors).toEqual([
      'answer_index: expected an index into options (0..3), got 4',
    ])
  })

  it('insists on one rationale per option', () => {
    const result = validatePayload('multiple_choice', {
      ...good,
      rationales: ['Right.', 'Weaker.'],
    })
    expect(result.errors).toEqual([
      'rationales: expected one per option (4), got 2',
    ])
  })

  it('rejects duplicated options, which make the question unanswerable', () => {
    const result = validatePayload('multiple_choice', {
      ...good,
      options: ['A monoid', 'A monoid', 'A pointer', 'A burrito'],
    })
    expect(result.errors).toEqual(['options: expected distinct options'])
  })
})

describe('validatePayload — open_question', () => {
  const good = {
    prompt: 'Explain what a monad is.',
    model_answer: 'A monoid in the category of endofunctors.',
    criteria: ['Mentions monoid', 'Mentions endofunctors'],
  }

  it('accepts a prompt, a model answer and its criteria', () => {
    expect(validatePayload('open_question', good).valid).toBe(true)
  })

  it('insists on at least one grading criterion', () => {
    expect(validatePayload('open_question', { ...good, criteria: [] }).valid).toBe(false)
  })
})

describe('validatePayload — an unknown format', () => {
  it('is rejected rather than waved through', () => {
    expect(validatePayload('concept_map', {}).errors).toEqual([
      ': unknown artefact format "concept_map"',
    ])
  })
})

describe('reading and tasks', () => {
  it('reads a summary and a glossary, and answers everything else', () => {
    expect(READING_FORMATS).toEqual(['summary', 'glossary'])
    expect(TASK_FORMATS).toEqual(['flashcard', 'cloze', 'multiple_choice', 'open_question'])
  })

  it('splits the catalogue in two with nothing left over and nothing in both', () => {
    expect([...READING_FORMATS, ...TASK_FORMATS].sort()).toEqual([...FORMATS].sort())
    expect(READING_FORMATS.some((format) => TASK_FORMATS.includes(format))).toBe(false)
  })

  it('names which side a format is on', () => {
    expect(formatKind('summary')).toBe('reading')
    expect(formatKind('cloze')).toBe('task')
    expect(formatKind('concept_map')).toBe(null)
  })

  it('answers the two questions the surfaces actually ask', () => {
    expect(isReadingFormat('glossary')).toBe(true)
    expect(isReadingFormat('flashcard')).toBe(false)
    expect(isTaskFormat('open_question')).toBe(true)
    expect(isTaskFormat('summary')).toBe(false)
    expect(isTaskFormat('concept_map')).toBe(false)
  })
})
