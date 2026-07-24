/**
 * A deliberately small JSON Schema validator.
 *
 * OpenRouter forwards our schema to the provider, but structured output is a
 * best effort: models drop properties, invent extra ones and return strings
 * where numbers were asked for. So the schema has to be checked again on our
 * side before the object is trusted. Only the keywords the artefact schemas
 * actually use are implemented — `type`, `enum`, `required`, `properties`,
 * `additionalProperties`, `items`, `minItems`/`maxItems`, `minLength`,
 * `minimum`/`maximum`. Anything else in a schema is passed to the model but
 * ignored here, which is the safe direction: it can only make validation more
 * permissive, never wrongly reject a good answer.
 *
 * Errors are collected rather than thrown, and every one of them names its
 * path, because the message is fed back to the model on the retry.
 */

function typeOf(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function matchesType(value, type) {
  if (type === 'integer') return Number.isInteger(value)
  if (type === 'number') return typeof value === 'number' && !Number.isNaN(value)
  return typeOf(value) === type
}

function check(value, schema, path, errors) {
  if (!schema || typeof schema !== 'object') return

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(`${path}: expected ${types.join(' or ')}, got ${typeOf(value)}`)
      return
    }
  }

  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push(
      `${path}: expected one of ${schema.enum.join(', ')}, got ${JSON.stringify(value)}`,
    )
    return
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      const plural = schema.minLength === 1 ? 'character' : 'characters'
      errors.push(
        `${path}: expected at least ${schema.minLength} ${plural}, got ${value.length}`,
      )
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: expected >= ${schema.minimum}, got ${value}`)
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: expected <= ${schema.maximum}, got ${value}`)
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(
        `${path}: expected at least ${schema.minItems} items, got ${value.length}`,
      )
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(
        `${path}: expected at most ${schema.maxItems} items, got ${value.length}`,
      )
    }
    if (schema.items) {
      value.forEach((item, index) =>
        check(item, schema.items, `${path}[${index}]`, errors),
      )
    }
    return
  }

  if (typeOf(value) === 'object') {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) {
        errors.push(`${path}: missing required property "${key}"`)
      }
    }
    const properties = schema.properties ?? {}
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) {
          errors.push(`${path}: unexpected property "${key}"`)
        }
      }
    }
    for (const [key, subSchema] of Object.entries(properties)) {
      if (!Object.hasOwn(value, key)) continue
      const childPath = path ? `${path}.${key}` : key
      check(value[key], subSchema, childPath, errors)
    }
  }
}

/**
 * @param {unknown} value
 * @param {object} schema
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validate(value, schema) {
  const errors = []
  check(value, schema, '', errors)
  return { valid: errors.length === 0, errors }
}
