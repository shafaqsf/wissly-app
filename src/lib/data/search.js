import { unwrapList } from './result.js'

/* Global search: one field over everything, one query behind it.
 *
 * Searching is a reflex, not a question, and a reflex must not cost a model
 * call — so this is Postgres full text and nothing else. Every searchable
 * table carries a generated `tsvector` and a GIN index (migration 006), and
 * `search_index` unions the five of them.
 *
 * The union lives in the database rather than here on purpose. Five reads
 * merged in JavaScript cannot rank across the five: it would have to pull
 * every match from every table back before it could sort them, and `limit`
 * would then mean "the first twenty of whatever came first".
 *
 * `search_index` is `security_invoker = true`, so each branch is filtered by
 * its own table's row level security. There is no `user_id` filter below and
 * there must not be one — a filter in the application is not a boundary.
 */

/** The five things a hit can be, in the order the view unions them. */
export const SEARCH_KINDS = Object.freeze([
  'source',
  'section',
  'concept',
  'artefact',
  'conversation',
])

/** A reflex must not pull the whole library back on every keystroke. */
const DEFAULT_LIMIT = 20

/**
 * @param {object} supabase
 * @param {object} options
 * @param {string} options.query what the learner typed
 * @param {string} [options.subjectId] scope to one course
 * @param {string[]} [options.kinds] scope to some of `SEARCH_KINDS`
 * @param {number} [options.limit]
 * @returns {Promise<Array<{kind: string, id: string, subjectId: string|null,
 *   parentId: string|null, title: string, snippet: string, createdAt: string}>>}
 */
export async function search(
  supabase,
  { query, subjectId, kinds, limit = DEFAULT_LIMIT } = {},
) {
  if (kinds) {
    const unknown = kinds.filter((kind) => !SEARCH_KINDS.includes(kind))
    if (unknown.length > 0) {
      throw new Error(`"${unknown[0]}" is not a searchable kind.`)
    }
  }

  const text = String(query ?? '').trim()
  if (text === '') return []

  let statement = supabase
    .from('search_index')
    .select('kind, id, subject_id, parent_id, title, snippet, created_at')
    // `websearch` rather than `plain`, so quoting a phrase and prefixing a
    // word with `-` mean what a learner already expects them to mean.
    .textSearch('document', text, { type: 'websearch', config: 'english' })

  if (subjectId) statement = statement.eq('subject_id', subjectId)
  if (kinds) statement = statement.in('kind', kinds)

  const rows = unwrapList(
    await statement.order('created_at', { ascending: false }).limit(limit),
    'search your material',
  )

  return rows.map((row) => ({
    kind: row.kind,
    id: row.id,
    subjectId: row.subject_id ?? null,
    parentId: row.parent_id ?? null,
    title: row.title,
    snippet: row.snippet ?? '',
    createdAt: row.created_at,
  }))
}
