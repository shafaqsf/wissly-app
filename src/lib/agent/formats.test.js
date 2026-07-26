// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  FORMATS,
  PAYLOAD_SCHEMAS,
  READING_FORMATS,
  TASK_FORMATS,
  TEACH_BACK_GRADE_SCHEMA,
  formatKind,
  isFormat,
  isReadingFormat,
  isTaskFormat,
  validatePayload,
} from './formats.js'
import { validate } from './schema.js'

describe('FORMATS', () => {
  it('is the whole catalogue, in the order the database enumerates it', () => {
    expect(FORMATS).toEqual([
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
  })

  it('has a payload schema for every format and no schema without a format', () => {
    expect(Object.keys(PAYLOAD_SCHEMAS).sort()).toEqual([...FORMATS].sort())
  })

  it('recognises a format name', () => {
    expect(isFormat('cloze')).toBe(true)
    expect(isFormat('comparison_table')).toBe(true)
    expect(isFormat('ordering')).toBe(true)
    expect(isFormat('practice_exam')).toBe(true)
    expect(isFormat('concept_map')).toBe(false)
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

describe('validatePayload — comparison_table', () => {
  const good = {
    items: ['Mean', 'Median'],
    dimensions: ['Sensitive to outliers', 'Always one of the data points'],
    cells: [
      { item_index: 0, dimension_index: 0, value: 'Yes', rationale: 'A single extreme value shifts it.' },
      { item_index: 0, dimension_index: 1, value: 'No', rationale: 'It is an average, not a member.' },
      { item_index: 1, dimension_index: 0, value: 'No', rationale: 'Only the middle rank matters.' },
      { item_index: 1, dimension_index: 1, value: 'Usually', rationale: 'It is a data point for odd counts.' },
    ],
  }

  it('accepts a complete grid of items by dimensions', () => {
    expect(validatePayload('comparison_table', good).valid).toBe(true)
  })

  it('insists on at least two items, since one thing has nothing to compare against', () => {
    expect(
      validatePayload('comparison_table', { ...good, items: ['Mean'] }).valid,
    ).toBe(false)
  })

  it('rejects a cell whose item_index points past the items', () => {
    const result = validatePayload('comparison_table', {
      ...good,
      cells: [{ ...good.cells[0], item_index: 2 }, ...good.cells.slice(1)],
    })
    expect(result.errors).toContain(
      'cells[0].item_index: expected an index into items (0..1), got 2',
    )
  })

  it('rejects a cell whose dimension_index points past the dimensions', () => {
    const result = validatePayload('comparison_table', {
      ...good,
      cells: [{ ...good.cells[0], dimension_index: 5 }, ...good.cells.slice(1)],
    })
    expect(result.errors).toContain(
      'cells[0].dimension_index: expected an index into dimensions (0..1), got 5',
    )
  })

  it('rejects a grid missing a cell', () => {
    // Three items by two dimensions needs six cells; five leaves a gap. Both
    // counts stay inside minItems/maxItems on `cells`, so this is the cross
    // check catching what the schema alone cannot.
    const result = validatePayload('comparison_table', {
      items: ['Mean', 'Median', 'Mode'],
      dimensions: good.dimensions,
      cells: [
        ...good.cells,
        { item_index: 2, dimension_index: 0, value: 'No', rationale: 'The most frequent value is unmoved.' },
      ],
    })
    expect(result.errors).toEqual([
      'cells: expected one per (item, dimension) pair (6), got 5',
    ])
  })

  it('rejects two cells claiming the same (item, dimension) pair', () => {
    const result = validatePayload('comparison_table', {
      ...good,
      cells: [good.cells[0], good.cells[0], good.cells[2], good.cells[3]],
    })
    expect(result.errors).toContain('cells[1]: duplicate cell for item 0, dimension 0')
  })
})

describe('validatePayload — ordering', () => {
  const good = {
    prompt: 'Put the steps of long division in order.',
    items: ['Divide', 'Multiply', 'Subtract', 'Bring down the next digit'],
    rationale: 'Each step operates on the remainder the previous one left behind.',
  }

  it('accepts a prompt, the items in their correct order and a rationale', () => {
    expect(validatePayload('ordering', good).valid).toBe(true)
  })

  it('insists on at least three items, since two have only one order to get right', () => {
    expect(
      validatePayload('ordering', { ...good, items: ['Divide', 'Multiply'] }).valid,
    ).toBe(false)
  })

  it('rejects duplicated items, which make the order unrecoverable', () => {
    const result = validatePayload('ordering', {
      ...good,
      items: ['Divide', 'Divide', 'Subtract', 'Bring down the next digit'],
    })
    expect(result.errors).toEqual(['items: expected distinct items'])
  })
})

describe('validatePayload — practice_exam', () => {
  const good = {
    title: 'Eigenvalues, timed',
    instructions: 'Answer every question in order. Ten minutes, no notes.',
    time_limit_minutes: 10,
    items: [
      { artefact_id: 'artefact-1', format: 'flashcard' },
      { artefact_id: 'artefact-2', format: 'multiple_choice' },
    ],
  }

  it('accepts a title, instructions, a time limit and the tasks it draws from', () => {
    expect(validatePayload('practice_exam', good).valid).toBe(true)
  })

  it('insists on at least two items, since one question is not an exam', () => {
    expect(
      validatePayload('practice_exam', { ...good, items: [good.items[0]] }).valid,
    ).toBe(false)
  })

  it('rejects an item format outside the answerable catalogue', () => {
    const result = validatePayload('practice_exam', {
      ...good,
      items: [good.items[0], { artefact_id: 'artefact-3', format: 'summary' }],
    })
    expect(result.valid).toBe(false)
  })

  it('refuses to nest a practice exam inside itself', () => {
    const result = validatePayload('practice_exam', {
      ...good,
      items: [good.items[0], { artefact_id: 'artefact-3', format: 'practice_exam' }],
    })
    expect(result.valid).toBe(false)
  })

  it('rejects a time limit of zero, since an exam has to take some time', () => {
    expect(validatePayload('practice_exam', { ...good, time_limit_minutes: 0 }).valid).toBe(
      false,
    )
  })

  it('rejects the same task referenced twice', () => {
    const result = validatePayload('practice_exam', {
      ...good,
      items: [good.items[0], good.items[0]],
    })
    expect(result.errors).toContain(
      'items[1].artefact_id: duplicate reference to artefact-1',
    )
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
  it('reads processed material and answers everything worth scoring', () => {
    expect(READING_FORMATS).toEqual(['summary', 'glossary', 'comparison_table'])
    expect(TASK_FORMATS).toEqual([
      'flashcard',
      'cloze',
      'multiple_choice',
      'open_question',
      'ordering',
      'practice_exam',
    ])
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

describe('TEACH_BACK_GRADE_SCHEMA', () => {
  const grade = {
    covered: [{ point: 'Named the invariant.', section_id: 's1' }],
    gaps: [{ point: 'Never mentioned termination.', section_id: 's1' }],
    wrong: [
      { claim: 'Said it always halts.', section_id: 's1', correction: 'It halts only for finite input.' },
    ],
    feedback: 'Good grasp of the invariant. The termination condition is still missing.',
  }

  it('closes every object, so a model cannot smuggle extra keys past us', () => {
    expect(TEACH_BACK_GRADE_SCHEMA.additionalProperties).toBe(false)
    expect(TEACH_BACK_GRADE_SCHEMA.properties.covered.items.additionalProperties).toBe(false)
    expect(TEACH_BACK_GRADE_SCHEMA.properties.wrong.items.additionalProperties).toBe(false)
  })

  it('requires a section_id on every covered, gap and wrong point — a grade with no citation is a guess', () => {
    expect(TEACH_BACK_GRADE_SCHEMA.properties.covered.items.required).toContain('section_id')
    expect(TEACH_BACK_GRADE_SCHEMA.properties.gaps.items.required).toContain('section_id')
    expect(TEACH_BACK_GRADE_SCHEMA.properties.wrong.items.required).toContain('section_id')
  })

  it('validates a well-formed grade', () => {
    expect(validate(grade, TEACH_BACK_GRADE_SCHEMA)).toEqual({ valid: true, errors: [] })
  })

  it('rejects a point with no section to check it against', () => {
    const bad = { ...grade, wrong: [{ claim: 'x', correction: 'y' }] }
    expect(validate(bad, TEACH_BACK_GRADE_SCHEMA).valid).toBe(false)
  })
})
