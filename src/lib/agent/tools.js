import 'server-only'

import { tool } from '@openai/agents'
import { z } from 'zod'

import { gapConcepts } from '../data/agent-runs.js'
import { listArtefacts } from '../data/artefacts.js'
import { conceptById } from '../data/concepts.js'
import { unwrap, unwrapList } from '../data/result.js'
import { dueArtefacts } from '../data/review.js'
import { search, SEARCH_KINDS } from '../data/search.js'
import { listSourcesWithSections } from '../data/sources.js'
import { gradeExplanation } from './artefacts.js'
import { FORMATS, READING_FORMATS, TASK_FORMATS, isTaskFormat } from './formats.js'
import { assertLearnerClient } from './guard.js'
import { buildStudyPlan } from './plan.js'

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
 *
 * **Every read is bounded.** A listing that inlined every page of every source
 * would be the whole library in one context window: slow, expensive, and no
 * more useful than a preview and an id the model can follow up on.
 */

/** One call must not be able to empty the library into the context window. */
const MAX_HITS = 20

/** Enough of a passage to recognise it; `read_section` fetches the rest. */
const PREVIEW_CHARS = 240

/** More than this in one sitting is not a session, it is a punishment. */
const MAX_DUE = 30

function preview(text) {
  const content = String(text ?? '')
  return content.length <= PREVIEW_CHARS ? content : `${content.slice(0, PREVIEW_CHARS)}…`
}

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
  assertLearnerClient(supabase)

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
  assertLearnerClient(supabase)

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
  assertLearnerClient(supabase)

  return unwrapList(
    await supabase
      .from('subjects')
      .select('id, title')
      .order('created_at', { ascending: false }),
    'list your courses',
  )
}

/**
 * The shelf: every source of a course with the sections it was cut into.
 *
 * Previews rather than passages. The model gets enough to choose which section
 * to work on and an id to read it with, which is the whole job of a listing.
 */
export async function listSources(supabase, { subjectId, archived = false } = {}) {
  assertLearnerClient(supabase)

  const sources = await listSourcesWithSections(supabase, { subjectId, archived })

  return sources.map((source) => ({
    source_id: source.id,
    subject_id: source.subject_id ?? null,
    kind: source.kind,
    title: source.title,
    archived_at: source.archived_at ?? null,
    sections: (source.sections ?? []).map((section) => ({
      section_id: section.id,
      ordinal: section.ordinal,
      anchor: section.anchor ?? null,
      preview: preview(section.content),
    })),
  }))
}

/** The shape a stored artefact takes on its way to the model. */
function asArtefact(row) {
  return {
    artefact_id: row.id,
    subject_id: row.subject_id ?? null,
    section_id: row.section_id ?? null,
    format: row.format,
    payload: row.payload,
    origin: row.origin ?? 'manual',
    anchor: row.anchor ?? null,
    archived_at: row.archived_at ?? null,
  }
}

/**
 * The workbench, read: the answered formats.
 *
 * Reading and tasks are two lists over one table, and the split is the one the
 * four areas are built on. A tool that blurred it would let "archive my
 * flashcards" reach a summary.
 */
export async function listTasks(
  supabase,
  { subjectId, sourceId, sectionId, format = null, archived = false } = {},
) {
  assertLearnerClient(supabase)

  if (format != null && !isTaskFormat(format)) {
    throw new Error(
      `"${format}" is not a task format. The answered formats are ${TASK_FORMATS.join(', ')}; use list_reading for what is read.`,
    )
  }

  const rows = await listArtefacts(supabase, {
    subjectId,
    sourceId,
    sectionId,
    formats: format ? [format] : [...TASK_FORMATS],
    archived,
  })

  return rows.map(asArtefact)
}

/** Reading: summaries and glossary entries, which produce no evidence. */
export async function listReading(
  supabase,
  { subjectId, sourceId, sectionId, archived = false } = {},
) {
  assertLearnerClient(supabase)

  const rows = await listArtefacts(supabase, {
    subjectId,
    sourceId,
    sectionId,
    formats: [...READING_FORMATS],
    archived,
  })

  return rows.map(asArtefact)
}

/** What is due now, so the agent can plan a round rather than guess at one. */
export async function dueTasks(supabase, { subjectId, limit = MAX_DUE } = {}) {
  assertLearnerClient(supabase)

  const rows = await dueArtefacts(supabase, {
    subjectId,
    limit: Math.min(Math.max(Number(limit) || MAX_DUE, 1), MAX_DUE),
  })

  return rows.map((row) => ({
    ...asArtefact(row),
    reps: row.state?.reps ?? 0,
    lapses: row.state?.lapses ?? 0,
    due_at: row.state?.due_at ?? null,
  }))
}

/**
 * One field over sources, sections, concepts, tasks, reading and threads.
 *
 * Postgres full text, no model call. Searching is a reflex, and a reflex that
 * costs a completion is a reflex nobody uses twice.
 */
export async function searchEverything(supabase, { query, subjectId, kinds, limit } = {}) {
  assertLearnerClient(supabase)

  return search(supabase, { query, subjectId, kinds, limit })
}

/**
 * What demonstrably does not hold yet: concepts that have been answered and
 * scored below mastery, worst first, each naming the section it came from.
 *
 * "Demonstrably" is the whole point, and it is `gapConcepts`' definition, not
 * a new one: a concept never attempted has produced no evidence and is not a
 * gap, it is untouched. This is a read — nothing is generated or scheduled —
 * so the agent surfaces it as a suggestion ("you seem to be struggling with
 * X, want more practice on it?") and only calls make_artefacts if the learner
 * says yes, through the ordinary write path with its usual undo.
 */
export async function detectGaps(supabase, { subjectId, limit = 20 } = {}) {
  assertLearnerClient(supabase)

  return gapConcepts(supabase, { subjectId, limit })
}

/**
 * A suggested plan for one course: what to clear, what to strengthen, what to
 * read next — built from what is due, `detectGaps`' own gap report, and which
 * sections have nothing generated from them yet.
 *
 * The composing is pure and lives in `plan.js`; this is the read that feeds
 * it. Like `detectGaps`, it changes nothing — accepting an item is a separate
 * request that reaches make_artefacts the ordinary way.
 */
export async function suggestLearningPlan(supabase, { subjectId, sessionSize } = {}) {
  assertLearnerClient(supabase)

  const [sources, made, due, gaps] = await Promise.all([
    listSourcesWithSections(supabase, { subjectId }),
    listArtefacts(supabase, { subjectId, formats: [...FORMATS] }),
    dueArtefacts(supabase, { subjectId, limit: MAX_DUE }),
    gapConcepts(supabase, { subjectId }),
  ])

  const generated = new Set(made.map((artefact) => artefact.section_id).filter(Boolean))

  const ungenerated = sources.flatMap((source) =>
    (source.sections ?? [])
      .filter((section) => !generated.has(section.id))
      .map((section) => ({
        id: section.id,
        ordinal: section.ordinal,
        sourceId: source.id,
        sourceTitle: source.title,
      })),
  )

  return buildStudyPlan({
    dueCount: due.length,
    gaps: gaps.map((gap) => ({
      id: gap.id,
      name: gap.name,
      mastery: gap.mastery,
      sectionOrdinal: gap.sectionOrdinal,
    })),
    ungenerated,
    sessionSize,
  })
}

/**
 * Grade a teach-back explanation live, against the concept's own section.
 *
 * This is a read: it changes no row and is never recorded in `agent_actions`,
 * so it belongs beside `search_sections` rather than in the writing surface —
 * every mode, including Chat and the Socratic Tutor, holds it. It differs
 * from every other tool in this file in one way: it needs a model call, so it
 * is one of the few read-only tools that also needs the structured client —
 * see `needsClient` below.
 */
export async function gradeExplanationTool(supabase, { conceptId, explanation, client }) {
  assertLearnerClient(supabase)

  const concept = await conceptById(supabase, { id: conceptId })
  if (!concept) throw new Error(`Concept ${conceptId} was not found.`)

  const sections = []
  if (concept.section_id) {
    const section = await readSection(supabase, { sectionId: concept.section_id })
    sections.push({
      id: section.section_id,
      ordinal: section.ordinal,
      content: section.content,
      anchor: section.anchor,
    })
  }

  return gradeExplanation({ client, concept: { term: concept.term }, sections, explanation })
}

/**
 * Bind the read-only tools to one request's client.
 *
 * The SDK calls `execute` with the model's arguments. The client is closed
 * over rather than passed through the model, because an identity the model
 * can name is an identity the model can be talked into changing.
 *
 * A read is not always free of the model — `grade_explanation` judges an
 * explanation and that judgement is a completion, not a query. `needsClient`
 * on a tool's definition is the one bit that says so; every other tool never
 * sees `client` at all, so a definition that never declared it cannot be
 * talked into spending a call it was not written to spend.
 *
 * @param {object} supabase the request-scoped client
 * @param {{client?: object}} [context]
 */
export function readOnlyTools(supabase, { client } = {}) {
  return READ_ONLY_TOOLS.map((definition) =>
    tool({
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
      execute: (input) =>
        definition.run(supabase, {
          ...(input ?? {}),
          ...(definition.needsClient ? { client } : {}),
        }),
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
  {
    name: 'list_sources',
    description:
      'List the material filed under a course — every source with the sections it was cut into, each with its anchor and a preview. Use this to choose which passages to work on; read_section gets the full text of one.',
    parameters: z.object({
      subjectId: z.string().nullable().describe('The course, or null for all of them.'),
      archived: z.boolean().describe('true to list the archive instead of the shelf.'),
    }),
    run: (supabase, input) => listSources(supabase, input),
  },
  {
    name: 'list_tasks',
    description: `List the learner’s tasks — ${TASK_FORMATS.join(', ')}. Filter by course, source, section or one type. Use this before generating, so you can see what already exists, and before compose_practice_exam, to choose which tasks to include.`,
    parameters: z.object({
      subjectId: z.string().nullable().describe('The course, or null for all of them.'),
      sourceId: z.string().nullable().describe('Only tasks from this source, or null.'),
      sectionId: z.string().nullable().describe('Only tasks from this passage, or null.'),
      format: z
        .string()
        .nullable()
        .describe(`One of ${TASK_FORMATS.join(', ')}, or null for all of them.`),
      archived: z.boolean().describe('true to list the archive instead.'),
    }),
    run: (supabase, input) => listTasks(supabase, input),
  },
  {
    name: 'list_reading',
    description:
      'List the reading generated from a course — summaries and glossary entries. These are read rather than answered: they are never due and never scored.',
    parameters: z.object({
      subjectId: z.string().nullable().describe('The course, or null for all of them.'),
      sourceId: z.string().nullable().describe('Only reading from this source, or null.'),
      sectionId: z.string().nullable().describe('Only reading from this passage, or null.'),
      archived: z.boolean().describe('true to list the archive instead.'),
    }),
    run: (supabase, input) => listReading(supabase, input),
  },
  {
    name: 'due_tasks',
    description:
      'What is due for review now, oldest first, with how often each has been answered and missed. Use this to plan a round or to notice what is being forgotten.',
    parameters: z.object({
      subjectId: z.string().nullable().describe('The course, or null for all of them.'),
      limit: z.number().describe('How many to look at, 1 to 30.'),
    }),
    run: (supabase, input) => dueTasks(supabase, input),
  },
  {
    name: 'search_everything',
    description: `Search all of the learner's wissly at once — sources, passages, concepts, tasks, reading and past conversations. Cheaper and broader than search_sections, which searches passages only. Returns the kind of each hit: ${SEARCH_KINDS.join(', ')}.`,
    parameters: z.object({
      query: z.string().describe('What to look for. Quoting a phrase and prefixing a word with - both work.'),
      subjectId: z.string().nullable().describe('Limit to one course, or null.'),
      kinds: z
        .array(z.string())
        .nullable()
        .describe(`Limit to some of ${SEARCH_KINDS.join(', ')}, or null for all.`),
    }),
    run: (supabase, input) =>
      searchEverything(supabase, { ...input, kinds: input.kinds ?? undefined }),
  },
  {
    name: 'detect_gaps',
    description:
      'What demonstrably does not hold yet, worst first: concepts that have been answered and scored below mastery, each naming the section it came from. A concept never attempted is not a gap — nothing has been demonstrated about it, so it is left out. Use this to suggest practice, in words — "you seem to be struggling with X, want more artefacts on it?" — and only call make_artefacts if the learner says yes.',
    parameters: z.object({
      subjectId: z.string().nullable().describe('The course, or null for all of them.'),
      limit: z.number().nullable().describe('How many to return, worst first. Defaults to 20.'),
    }),
    run: (supabase, input) =>
      detectGaps(supabase, { ...input, limit: input.limit ?? undefined }),
  },
  {
    name: 'suggest_learning_plan',
    description:
      'A suggested session-by-session plan for one course: clear what is due, strengthen the weakest concepts, then read sections nothing has been generated from yet. This is a suggestion to read out to the learner, never a write — nothing is scheduled or generated until they ask for a specific item.',
    parameters: z.object({
      subjectId: z.string().nullable().describe('The course to plan, or null to plan across all of them.'),
      sessionSize: z.number().nullable().describe('Items per session, 1 to 10. Defaults to 3.'),
    }),
    run: (supabase, input) =>
      suggestLearningPlan(supabase, { ...input, sessionSize: input.sessionSize ?? undefined }),
  },
  {
    name: 'grade_explanation',
    description:
      'Grade a teach-back explanation: the learner explains a concept in their own words and this judges it live against the concept’s own source material — there is nothing pre-written to compare it to. Returns what was covered, what depth was missing, and what was actively wrong, each naming the section it was checked against. Changes nothing and needs no run to attribute — it is a read that happens to need a model call.',
    parameters: z.object({
      conceptId: z.string().describe('The concept the learner is explaining, from list_courses or a search.'),
      explanation: z.string().describe('What the learner said, in their own words.'),
    }),
    needsClient: true,
    run: (supabase, input) => gradeExplanationTool(supabase, input),
  },
]
