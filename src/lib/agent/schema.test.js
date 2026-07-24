// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { validate } from './schema.js'

describe('validate', () => {
  it('accepts a value of the declared primitive type', () => {
    expect(validate('hello', { type: 'string' })).toEqual({
      valid: true,
      errors: [],
    })
  })

  it('names the path and the expectation when the type is wrong', () => {
    const result = validate({ front: 7 }, {
      type: 'object',
      properties: { front: { type: 'string' } },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['front: expected string, got number'])
  })

  it('distinguishes integers from numbers', () => {
    expect(validate(2.5, { type: 'integer' }).valid).toBe(false)
    expect(validate(2, { type: 'integer' }).valid).toBe(true)
    expect(validate(2.5, { type: 'number' }).valid).toBe(true)
  })

  it('does not mistake null or an array for an object', () => {
    expect(validate(null, { type: 'object' }).errors).toEqual([
      ': expected object, got null',
    ])
    expect(validate([], { type: 'object' }).errors).toEqual([
      ': expected object, got array',
    ])
  })

  it('reports every missing required property, not only the first', () => {
    const result = validate(
      { front: 'a' },
      {
        type: 'object',
        required: ['front', 'back', 'source'],
        properties: {
          front: { type: 'string' },
          back: { type: 'string' },
          source: { type: 'string' },
        },
      },
    )
    expect(result.errors).toEqual([
      ': missing required property "back"',
      ': missing required property "source"',
    ])
  })

  it('rejects unknown properties when additionalProperties is false', () => {
    const result = validate(
      { front: 'a', colour: 'red' },
      {
        type: 'object',
        additionalProperties: false,
        properties: { front: { type: 'string' } },
      },
    )
    expect(result.errors).toEqual([': unexpected property "colour"'])
  })

  it('allows unknown properties by default', () => {
    expect(
      validate(
        { front: 'a', extra: 1 },
        { type: 'object', properties: { front: { type: 'string' } } },
      ).valid,
    ).toBe(true)
  })

  it('validates array items and reports the offending index', () => {
    const result = validate(['a', 2], {
      type: 'array',
      items: { type: 'string' },
    })
    expect(result.errors).toEqual(['[1]: expected string, got number'])
  })

  it('enforces minItems and maxItems', () => {
    const schema = { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 }
    expect(validate(['a', 'b'], schema).errors).toEqual([
      ': expected at least 3 items, got 2',
    ])
    expect(validate(['a', 'b', 'c', 'd'], schema).errors).toEqual([
      ': expected at most 3 items, got 4',
    ])
  })

  it('enforces enum membership', () => {
    const schema = { type: 'string', enum: ['flashcard', 'cloze'] }
    expect(validate('cloze', schema).valid).toBe(true)
    expect(validate('poem', schema).errors).toEqual([
      ': expected one of flashcard, cloze, got "poem"',
    ])
  })

  it('enforces minimum and maximum on numbers', () => {
    const schema = { type: 'integer', minimum: 0, maximum: 3 }
    expect(validate(-1, schema).errors).toEqual([': expected >= 0, got -1'])
    expect(validate(4, schema).errors).toEqual([': expected <= 3, got 4'])
  })

  it('rejects an empty string when minLength is 1', () => {
    expect(validate('', { type: 'string', minLength: 1 }).errors).toEqual([
      ': expected at least 1 character, got 0',
    ])
  })

  it('walks nested structures and builds a readable path', () => {
    const schema = {
      type: 'object',
      properties: {
        options: {
          type: 'array',
          items: {
            type: 'object',
            required: ['text'],
            properties: { text: { type: 'string' } },
          },
        },
      },
    }
    const result = validate({ options: [{ text: 'a' }, { text: 3 }, {}] }, schema)
    expect(result.errors).toEqual([
      'options[1].text: expected string, got number',
      'options[2]: missing required property "text"',
    ])
  })

  it('treats an absent schema as "anything goes"', () => {
    expect(validate({ whatever: true }, {}).valid).toBe(true)
  })
})
