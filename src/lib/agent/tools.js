import 'server-only'

import { tool } from '@openai/agents'
import { z } from 'zod'

import { unwrap, unwrapList } from '../data/result.js'

/**
 * What the agent can do.
 *
 * Two rules hold for every tool in this file, and both are structural rather
 * than advisory.
 *
 * **The client is the learner's.** Every function here takes the
 * request-scoped Supabase client built from the session cookie — the same one
 * the interface uses, subject to the same policies. Nothing in
 * `src/lib/agent` may reach for the secret key, and a test asserts that the
 * string does not appear here. The agent reads uploaded PDFs, which is to say
 * attacker-controlled input, by design; row level security is what keeps a
 * prompt injection inside the account it was smuggled into.
 *
 * **A passage never travels without its anchor.** wissly promises that any
 * generated claim can be traced back to the page it came from. If a tool
 * returned bare prose, the model would have nothing to cite even when it
 * wanted to, and the promise would depend on the model's memory. So the
 * anchor comes back attached to the content, every time.
 *
 * This module holds the read-only half. Writing tools arrive with
 * `agent_actions` and undo.
 */

/** One call must not be able to empty the library into the context window. */
const MAX_HITS = 20

const SECTION_SHAPE = `
  id,
  ordinal,
  content,
  anchor,
  sources ( id, title, subject_id )
`

/** The shape the model sees. Flat, named for what it means, anchor included. */
function asPassage(row) {
  return {
    section_id: row.id,
    ordinal: row.ordinal,
    content: row.content,
    anchor: row.anchor ?? null,
    source_id: row.sources?.id ?? null,
    source_title: row.sources?.title ?? null,
    subject_id: row.sources?.subject_id ?? null,
  }
}

/** PostgREST treats `%` and `_` as wildcards inside `ilike`. */
function escapeForLike(text) {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export async function searchSections(supabase, { query, limit = 8, subjectId } = {}) {
  const term = String(query ?? '').trim()
  if (term === '') {
    throw new Error('Say what to search for.')
  }

  let request = supabase
    .from('sections')
    .select(SECTION_SHAPE)
    .ilike('content', `%${escapeForLike(term)}%`)
    .limit(Math.min(Math.max(Number(limit) || 8, 1), MAX_HITS))

  if (subjectId) request = request.eq('sources.subject_id', subjectId)

  return unwrapList(await request, 'search your material').map(asPassage)
}

export async function readSection(supabase, { sectionId }) {
  const row = unwrap(
    await supabase.from('sections').select(SECTION_SHAPE).eq('id', sectionId).maybeSingle(),
    'read the passage',
  )

  // Under RLS a section belonging to someone else is indistinguishable from
  // one that does not exist, which is exactly right — and this message is
  // what the model sees, so it must not speculate about which it was.
  if (!row) throw new Error(`Section ${sectionId} was not found.`)

  return asPassage(row)
}

export async function listCourses(supabase) {
  return unwrapList(
    await supabase
      .from('subjects')
      .select('id, title')
      .order('created_at', { ascending: false }),
    'list your courses',
  )
}

/**
 * Bind the read-only tools to one request's client.
 *
 * The SDK calls `execute` with the model's arguments. The client is closed
 * over rather than passed through the model, because an identity the model
 * can name is an identity the model can be talked into changing.
 *
 * @param {object} supabase the request-scoped client
 */
export function readOnlyTools(supabase) {
  return READ_ONLY_TOOLS.map((definition) =>
    tool({
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
      execute: (input) => definition.run(supabase, input ?? {}),
    }),
  )
}

/**
 * The catalogue, separate from the binding so it can be inspected without a
 * client — the tests read it, and so does anything that has to explain to the
 * learner what the agent may do.
 */
export const READ_ONLY_TOOLS = [
  {
    name: 'search_sections',
    description:
      'Search the learner’s own uploaded material for a phrase. Returns passages with the anchor (page, slide or timestamp) that locates each one in its source. Use this before answering anything factual.',
    parameters: z.object({
      query: z.string().describe('The phrase to look for in the material.'),
      subjectId: z
        .string()
        .nullable()
        .describe('Limit the search to one course, or null for all of them.'),
    }),
    run: (supabase, input) => searchSections(supabase, input),
  },
  {
    name: 'read_section',
    description:
      'Read one passage in full by its id, with its anchor. Use this when a search hit was cut short and you need the whole passage before citing it.',
    parameters: z.object({
      sectionId: z.string().describe('The id of the section to read.'),
    }),
    run: (supabase, input) => readSection(supabase, input),
  },
  {
    name: 'list_courses',
    description:
      'List the learner’s courses, so a search can be narrowed to one of them. Takes no arguments.',
    parameters: z.object({}),
    run: (supabase) => listCourses(supabase),
  },
]
