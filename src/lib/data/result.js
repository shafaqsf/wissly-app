/* Every Supabase call answers `{ data, error }` and never rejects. Left
 * alone, a failure returns `undefined` and the screen renders an empty state
 * for what is actually a broken query — the worst kind of bug, because it
 * looks like a working page with nothing in it.
 *
 * So every read and write in `src/lib/data` goes through here: a failure
 * becomes a thrown error carrying what the database said, and a caller that
 * does nothing at all fails loudly.
 */

export class DataError extends Error {
  constructor(message, { operation, cause } = {}) {
    super(message)
    this.name = 'DataError'
    this.operation = operation
    this.cause = cause
  }
}

/** Unwrap a Supabase result, or throw. */
export function unwrap({ data, error }, operation) {
  if (error) {
    throw new DataError(error.message ?? `Could not ${operation}.`, {
      operation,
      cause: error,
    })
  }

  return data
}

/** Unwrap a list, treating no rows as an empty list rather than as nothing. */
export function unwrapList(result, operation) {
  return unwrap(result, operation) ?? []
}
