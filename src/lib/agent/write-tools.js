import 'server-only'

import { tool } from '@openai/agents'
import { z } from 'zod'

import { unwrap, unwrapList } from '../data/result.js'
import { saveArtefacts } from '../data/artefacts.js'
import { recordAction } from '../data/agent-runs.js'
import { generateArtefact } from './artefacts.js'
import { readSection } from './tools.js'

/**
 * What the agent may change.
 *
 * Agent mode acts without asking at each step. Three properties make that
 * defensible rather than reckless, and all three live in this file:
 *
 * **It acts as the learner.** Same request-scoped client, same policies. The
 * secret key never reaches here — `tools.test.js` asserts the string does not
 * appear anywhere under `src/lib/agent`.
 *
 * **Every write is recorded with its inverse.** An `agent_actions` row per
 * call, carrying the payload that would put the row back. The inverse is
 * captured *before* the change, while the previous state is still known;
 * afterwards it is gone and no amount of care recovers it.
 *
 * **Nothing is destroyed.** No tool here issues a `delete` against material.
 * The one delete in the file is the inverse of an insert the agent itself
 * made moments earlier, which is a retraction rather than a loss.
 */

/** One call must not be able to spend a chapter's worth of tokens. */
const MAX_ARTEFACTS = 6

/**
 * Rename a course.
 *
 * The read of the old title is not a nicety. Without it the action is
 * recorded but not reversible, and an unreversible record is a log, not an
 * undo.
 */
export async function renameCourse(
  supabase,
  { userId, runId, courseId, title, record = recordAction },
) {
  const trimmed = String(title ?? '').trim()
  if (trimmed === '') throw new Error('A course needs a name.')

  const before = unwrap(
    await supabase.from('subjects').select('id, title').eq('id', courseId).maybeSingle(),
    'read the course',
  )
  if (!before) throw new Error(`Course ${courseId} was not found.`)

  const after = unwrap(
    await supabase
      .from('subjects')
      .update({ title: trimmed })
      .eq('id', courseId)
      .select('id, title')
      .single(),
    'rename the course',
  )

  await record(supabase, {
    userId,
    runId,
    tool: 'rename_course',
    args: { courseId, title: trimmed },
    result: { title: after.title },
    undo: { kind: 'restore_course_title', courseId, title: before.title },
  })

  return { course_id: after.id, title: after.title, previous_title: before.title }
}

/**
 * Make artefacts for one passage.
 *
 * The generation itself is the existing pipeline — `generateArtefact` and the
 * format schemas — because the agent should not have a second, subtly
 * different way of producing the same rows.
 */
export async function makeArtefacts(
  supabase,
  { userId, runId, sectionId, format = null, count = 1, client, record = recordAction },
) {
  const passage = await readSection(supabase, { sectionId })

  const wanted = Math.min(Math.max(Number(count) || 1, 1), MAX_ARTEFACTS)
  const made = []

  for (let index = 0; index < wanted; index += 1) {
    made.push(
      await generateArtefact({
        client,
        section: {
          id: passage.section_id,
          ordinal: passage.ordinal,
          content: passage.content,
          anchor: passage.anchor,
        },
        format,
        subjectId: passage.subject_id,
      }),
    )
  }

  const stored = await saveArtefacts(supabase, { userId, artefacts: made })

  await record(supabase, {
    userId,
    runId,
    tool: 'make_artefacts',
    args: { sectionId, format, count: wanted },
    result: { ids: stored.map((row) => row.id), formats: stored.map((row) => row.format) },
    // Retracting an insert the agent made a moment ago, not destroying
    // material the learner brought.
    undo: { kind: 'remove_artefacts', ids: stored.map((row) => row.id) },
  })

  return {
    made: stored.length,
    formats: stored.map((row) => row.format),
    section_id: passage.section_id,
    anchor: passage.anchor,
  }
}

/**
 * Apply the inverse of one recorded action.
 *
 * Dispatch on `undo.kind` rather than on the tool name: the tool may grow more
 * arguments, but what it takes to reverse a given row does not change once it
 * is written.
 */
export async function applyUndo(supabase, { undo }) {
  if (undo?.kind === 'restore_course_title') {
    unwrap(
      await supabase
        .from('subjects')
        .update({ title: undo.title })
        .eq('id', undo.courseId)
        .select('id')
        .single(),
      'put the course name back',
    )
    return { undone: 'rename_course' }
  }

  if (undo?.kind === 'remove_artefacts') {
    unwrapList(
      await supabase.from('artefacts').delete().in('id', undo.ids ?? []).select('id'),
      'take the artefacts back',
    )
    return { undone: 'make_artefacts', removed: (undo.ids ?? []).length }
  }

  throw new Error('That action cannot be undone.')
}

/**
 * Bind the writing tools to one run.
 *
 * `runId` is closed over, not passed through the model. An action attributed
 * to a run the model chose would be an audit trail the model can edit.
 */
export function writeTools(supabase, { userId, runId, client }) {
  return WRITE_TOOLS.map((definition) =>
    tool({
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
      execute: (input) =>
        definition.run(supabase, { ...(input ?? {}), userId, runId, client }),
    }),
  )
}

export const WRITE_TOOLS = [
  {
    name: 'rename_course',
    description:
      'Rename one of the learner’s courses. Use the course id from list_courses. The old name is kept so the learner can undo this.',
    parameters: z.object({
      courseId: z.string().describe('The id of the course to rename.'),
      title: z.string().describe('The new name.'),
    }),
    run: (supabase, input) => renameCourse(supabase, input),
  },
  {
    name: 'make_artefacts',
    description:
      'Generate learning artefacts — flashcard, cloze, multiple choice, open question, summary or glossary — from one passage of the learner’s material. Pass a format to choose, or omit it to let the format follow the passage. At most six per call.',
    parameters: z.object({
      sectionId: z.string().describe('The passage to generate from.'),
      format: z
        .string()
        .nullable()
        .describe('One of the six formats, or null to let the passage decide.'),
      count: z.number().describe('How many to make, 1 to 6.'),
    }),
    run: (supabase, input) => makeArtefacts(supabase, input),
  },
]
