import 'server-only'

import { tool } from '@openai/agents'
import { z } from 'zod'

import { recordAction } from '../data/agent-runs.js'
import {
  archiveArtefacts,
  createArtefact,
  moveArtefacts,
  rescheduleArtefacts,
  restoreArtefacts,
  saveArtefacts,
  updateArtefact,
} from '../data/artefacts.js'
import { createCourse } from '../data/courses.js'
import { unwrap, unwrapList } from '../data/result.js'
import { fsrsState, recordReview, scheduleFor } from '../data/review.js'
import { archiveSource, restoreSource } from '../data/sources.js'
import {
  createStandingOrder,
  getStandingOrder,
  updateStandingOrder,
} from '../data/standing-orders.js'
import { addMaterial as addMaterialToLibrary } from '../material/add-material.js'
import { generateArtefact, gradeAnswer } from './artefacts.js'
import { FORMATS, isFormat, validatePayload } from './formats.js'
import { assertLearnerClient } from './guard.js'
import { navigationIntent } from './navigation.js'
import { readSection } from './tools.js'

/**
 * What the agent may change.
 *
 * Agent mode acts without asking at each step. Four properties make that
 * defensible rather than reckless, and all four live in this file:
 *
 * **It acts as the learner.** Same request-scoped client, same policies. Every
 * function begins by refusing a client that would bypass row level security,
 * and `tools.test.js` greps this whole directory for the two names such a key
 * goes by.
 *
 * **Every write is recorded with its inverse.** An `agent_actions` row per
 * call, carrying the payload that would put the row back. The inverse is
 * captured *before* the change, while the previous state is still known;
 * afterwards it is gone and no amount of care recovers it. That is why almost
 * every function here reads before it writes, and why a bulk move records where
 * each row came from rather than only that rows moved.
 *
 * **Nothing the learner brought is destroyed.** Archiving writes
 * `archived_at`. The three deletes in this file are all inverses of inserts the
 * agent itself made moments earlier — a retraction, not a loss.
 *
 * **Auth and export are unreachable.** There is no tool for email, password,
 * account deletion, export or sharing, and there must be no way to name one:
 * export exists as a learner feature precisely because it carries data out of
 * the account, so it is a decision only the learner makes. A test asserts the
 * catalogue over the names.
 *
 * There is no spending cap, deliberately. Cost is made visible on the dashboard
 * and in Analytics rather than enforced here. The bounds below are on the size
 * of a single call, which is a different thing: they keep one tool call from
 * being a chapter, not the run from being a bill.
 */

/** One call must not be able to spend a chapter's worth of tokens. */
const MAX_ARTEFACTS = 6

/** One bulk call must not be able to touch the whole library. */
const MAX_IDS = 200

function ids(list) {
  const named = [...new Set((list ?? []).map(String).filter(Boolean))]

  if (named.length === 0) throw new Error('Name at least one thing to act on.')
  if (named.length > MAX_IDS) {
    throw new Error(`That is ${named.length} at once. Do at most ${MAX_IDS} in one call.`)
  }

  return named
}

/* --- courses ---------------------------------------------------------- */

/**
 * Create a course.
 *
 * Courses used to appear only as a side effect of adding material. Starting one
 * and then filling it is a thing the learner does, so it is a thing the agent
 * can do for them.
 */
export async function createCourseTool(supabase, { userId, runId, title, record = recordAction }) {
  assertLearnerClient(supabase)

  const course = await createCourse(supabase, { userId, title })

  await record(supabase, {
    userId,
    runId,
    tool: 'create_course',
    args: { title },
    result: { course_id: course.id, title: course.title },
    // Retracting an insert the agent made a moment ago. There is no material
    // filed under it yet, because it did not exist a moment ago.
    undo: { kind: 'remove_course', courseId: course.id },
  })

  return { course_id: course.id, title: course.title }
}

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
  assertLearnerClient(supabase)

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

/* --- material --------------------------------------------------------- */

/**
 * File material under a course.
 *
 * Ingest, source, sections, concepts — and no model call. Generating from the
 * material is a separate request, because "hand over a PDF and twelve calls
 * decide section 3 deserves a flashcard" is the behaviour the four areas exist
 * to remove. The agent may of course generate straight afterwards; the point is
 * that it has to choose to, and say so.
 */
export async function addMaterialTool(
  supabase,
  {
    userId,
    runId,
    course,
    title,
    text,
    record = recordAction,
    addMaterial = addMaterialToLibrary,
  },
) {
  assertLearnerClient(supabase)

  const body = String(text ?? '').trim()
  if (body === '') throw new Error('There is nothing to add. Paste the text you mean.')

  const result = await addMaterial({
    supabase,
    userId,
    material: { subject: course, title: title || 'Pasted text', kind: 'text', text: body },
  })

  await record(supabase, {
    userId,
    runId,
    tool: 'add_material',
    args: { course, title },
    result: {
      source_id: result.source.id,
      sections: result.sections.length,
      concepts: result.concepts.length,
    },
    // Soft, like every destruction the agent can reach. The learner empties
    // the archive by hand, and material is the last thing to take on trust.
    undo: { kind: 'archive_source', sourceId: result.source.id },
  })

  return {
    course_id: result.subject.id,
    source_id: result.source.id,
    title: result.source.title,
    sections: result.sections.length,
    concepts: result.concepts.length,
  }
}

export async function archiveSourceTool(supabase, { userId, runId, sourceId, record = recordAction }) {
  assertLearnerClient(supabase)

  const source = await archiveSource(supabase, { id: sourceId })

  await record(supabase, {
    userId,
    runId,
    tool: 'archive_source',
    args: { sourceId },
    result: { title: source.title },
    undo: { kind: 'restore_source', sourceId },
  })

  return { source_id: sourceId, title: source.title, archived: true }
}

export async function restoreSourceTool(supabase, { userId, runId, sourceId, record = recordAction }) {
  assertLearnerClient(supabase)

  const source = await restoreSource(supabase, { id: sourceId })

  await record(supabase, {
    userId,
    runId,
    tool: 'restore_source',
    args: { sourceId },
    result: { title: source.title },
    undo: { kind: 'archive_source', sourceId },
  })

  return { source_id: sourceId, title: source.title, archived: false }
}

/* --- generating ------------------------------------------------------- */

/**
 * Make artefacts for one passage — a task type or reading, whichever was asked
 * for.
 *
 * The generation itself is the existing pipeline — `generateArtefact` and the
 * format schemas — because the agent should not have a second, subtly
 * different way of producing the same rows.
 */
export async function makeArtefacts(
  supabase,
  { userId, runId, sectionId, format = null, count = 1, client, record = recordAction },
) {
  assertLearnerClient(supabase)

  if (format != null && !isFormat(format)) {
    throw new Error(`"${format}" is not an artefact format. There are six: ${FORMATS.join(', ')}.`)
  }

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
 * Write one artefact by hand.
 *
 * The counterpart of "Write one" in the interface: it costs nothing, because no
 * model is asked anything. The payload still goes through the format's schema
 * and its cross-checks — a cloze with no blank is unusable whoever wrote it.
 */
export async function writeArtefact(
  supabase,
  { userId, runId, subjectId, sectionId = null, format, payload, record = recordAction },
) {
  assertLearnerClient(supabase)

  const { valid, errors } = validatePayload(format, payload)
  if (!valid) throw new Error(`That ${format} is unusable: ${errors.join('; ')}`)

  const stored = await createArtefact(supabase, {
    userId,
    subjectId,
    sectionId,
    format,
    payload,
    // The interface has to be able to say who wrote this card.
    origin: 'agent',
  })

  await record(supabase, {
    userId,
    runId,
    tool: 'write_artefact',
    args: { subjectId, sectionId, format },
    result: { id: stored.id, format: stored.format },
    undo: { kind: 'remove_artefacts', ids: [stored.id] },
  })

  return { artefact_id: stored.id, format: stored.format }
}

export async function editArtefact(
  supabase,
  { userId, runId, artefactId, payload, sectionId, record = recordAction },
) {
  assertLearnerClient(supabase)

  const before = unwrap(
    await supabase
      .from('artefacts')
      .select('id, format, payload, section_id')
      .eq('id', artefactId)
      .maybeSingle(),
    'read the card',
  )
  if (!before) throw new Error(`Artefact ${artefactId} was not found.`)

  if (payload !== undefined) {
    const { valid, errors } = validatePayload(before.format, payload)
    if (!valid) throw new Error(`That ${before.format} is unusable: ${errors.join('; ')}`)
  }

  const after = await updateArtefact(supabase, { id: artefactId, payload, sectionId })

  await record(supabase, {
    userId,
    runId,
    tool: 'edit_artefact',
    args: { artefactId },
    result: { format: after.format },
    undo: { kind: 'restore_artefact', artefactId, payload: before.payload },
  })

  return { artefact_id: artefactId, format: after.format }
}

/* --- tidying ---------------------------------------------------------- */

/**
 * Move a selection to another course.
 *
 * The inverse is per row, not per call. A selection drawn across two courses
 * that all moved to a third would otherwise come back to whichever course the
 * undo happened to remember, which is a plausible-looking way to lose things.
 */
export async function moveTasks(supabase, { userId, runId, ids: list, subjectId, record = recordAction }) {
  assertLearnerClient(supabase)

  const named = ids(list)

  const before = unwrapList(
    await supabase.from('artefacts').select('id, subject_id').in('id', named),
    'read what you selected',
  )

  const previous = {}
  for (const row of before) {
    const from = row.subject_id ?? 'none'
    previous[from] = [...(previous[from] ?? []), row.id]
  }

  const moved = await moveArtefacts(supabase, { ids: named, subjectId })

  await record(supabase, {
    userId,
    runId,
    tool: 'move_tasks',
    args: { ids: named, subjectId },
    result: { moved: moved.length },
    undo: { kind: 'move_artefacts_back', previous },
  })

  return { moved: moved.length, course_id: subjectId }
}

export async function archiveTasks(supabase, { userId, runId, ids: list, record = recordAction }) {
  assertLearnerClient(supabase)

  const named = ids(list)
  const archived = await archiveArtefacts(supabase, { ids: named })

  await record(supabase, {
    userId,
    runId,
    tool: 'archive_tasks',
    args: { ids: named },
    result: { archived: archived.length },
    undo: { kind: 'restore_artefacts', ids: named },
  })

  return { archived: archived.length }
}

export async function restoreTasks(supabase, { userId, runId, ids: list, record = recordAction }) {
  assertLearnerClient(supabase)

  const named = ids(list)
  const restored = await restoreArtefacts(supabase, { ids: named })

  await record(supabase, {
    userId,
    runId,
    tool: 'restore_tasks',
    args: { ids: named },
    result: { restored: restored.length },
    undo: { kind: 'archive_artefacts', ids: named },
  })

  return { restored: restored.length }
}

/* --- the schedule ----------------------------------------------------- */

/**
 * Push a selection out to a new due date.
 *
 * The previous dates are read one artefact at a time because that is what the
 * schedule view answers, and grouped by date so the inverse is one write per
 * distinct date rather than one per card.
 */
export async function rescheduleTasks(
  supabase,
  { userId, runId, ids: list, dueAt, record = recordAction },
) {
  assertLearnerClient(supabase)

  const named = ids(list)

  const byDate = new Map()
  for (const artefactId of named) {
    const state = await scheduleFor(supabase, { artefactId })
    // An artefact with no review has no state to move; `rescheduleArtefacts`
    // leaves it alone, so there is nothing to put back either.
    if (!state?.due_at) continue
    byDate.set(state.due_at, [...(byDate.get(state.due_at) ?? []), artefactId])
  }

  const moved = await rescheduleArtefacts(supabase, { ids: named, dueAt })

  await record(supabase, {
    userId,
    runId,
    tool: 'reschedule_tasks',
    args: { ids: named, dueAt: String(dueAt) },
    result: { rescheduled: moved.length },
    undo: {
      kind: 'reschedule_back',
      groups: [...byDate].map(([date, group]) => ({ dueAt: date, ids: group })),
    },
  })

  return { rescheduled: moved.length, due_at: String(dueAt) }
}

/**
 * Record evidence: one rating, and the date FSRS puts on it.
 *
 * `reviews` is an event log, so the inverse is removing the row the agent
 * appended. That is a retraction of its own write, and it is the only way an
 * undo can restore mastery to what it was — editing the row would leave a
 * grading in the history that never happened.
 */
export async function recordReviewTool(
  supabase,
  { userId, runId, artefactId, rating, record = recordAction },
) {
  assertLearnerClient(supabase)

  const schedule = await scheduleFor(supabase, { artefactId })

  const review = await recordReview(supabase, {
    userId,
    artefactId,
    rating,
    state: fsrsState(schedule),
  })

  await record(supabase, {
    userId,
    runId,
    tool: 'record_review',
    args: { artefactId, rating },
    result: { due_at: review.due_at, reps: review.reps },
    undo: { kind: 'remove_review', id: review.id },
  })

  return { artefact_id: artefactId, rating, due_at: review.due_at }
}

/**
 * Grade a free-text answer.
 *
 * A model call and nothing else — it reads, it judges, it changes no row. So it
 * writes no `agent_actions` row: there is nothing to undo, and a log of reads
 * would bury the writes that matter in the interface that renders them.
 */
export async function gradeAnswerTool(supabase, { question, answer, client }) {
  assertLearnerClient(supabase)

  return gradeAnswer({ client, question, answer })
}

/* --- driving the interface -------------------------------------------- */

/**
 * Send the learner where the result landed.
 *
 * The intent goes back as data and the bar performs it with the router it
 * already has. Nothing here reaches into the DOM, and the destination is one of
 * six named places rather than a path, so a prompt injection in an uploaded
 * handout cannot choose where the learner's browser goes next.
 *
 * No `agent_actions` row: nothing changed. Navigation is not a write, and
 * offering "Undo" on it would be offering to press Back.
 */
export async function showInInterface(
  supabase,
  { target, courseId, format, sourceId, sectionId, conceptId, onIntent },
) {
  assertLearnerClient(supabase)

  const intent = navigationIntent({ target, courseId, format, sourceId, sectionId, conceptId })

  onIntent?.(intent)

  return { intent, showed: intent.label }
}

/* --- standing orders -------------------------------------------------- */

export async function createStandingOrderTool(
  supabase,
  { userId, runId, instruction, schedule, record = recordAction },
) {
  assertLearnerClient(supabase)

  const order = await createStandingOrder(supabase, { userId, instruction, schedule })

  await record(supabase, {
    userId,
    runId,
    tool: 'create_standing_order',
    args: { instruction, schedule },
    result: { id: order.id },
    undo: { kind: 'remove_standing_order', id: order.id },
  })

  return { standing_order_id: order.id, instruction: order.instruction, schedule: order.schedule }
}

/** Edit an order or switch it off. The whole previous row is the inverse. */
export async function setStandingOrder(
  supabase,
  { userId, runId, standingOrderId, instruction, schedule, enabled, record = recordAction },
) {
  assertLearnerClient(supabase)

  const before = await getStandingOrder(supabase, { id: standingOrderId })
  if (!before) throw new Error(`Standing order ${standingOrderId} was not found.`)

  const after = await updateStandingOrder(supabase, {
    id: standingOrderId,
    instruction,
    schedule,
    enabled,
  })

  await record(supabase, {
    userId,
    runId,
    tool: 'set_standing_order',
    args: { standingOrderId, instruction, schedule, enabled },
    result: { enabled: after.enabled },
    undo: {
      kind: 'restore_standing_order',
      id: standingOrderId,
      instruction: before.instruction,
      schedule: before.schedule,
      enabled: before.enabled,
    },
  })

  return {
    standing_order_id: after.id,
    instruction: after.instruction,
    schedule: after.schedule,
    enabled: after.enabled,
  }
}

/* --- undo ------------------------------------------------------------- */

/**
 * Apply the inverse of one recorded action.
 *
 * Dispatch on `undo.kind` rather than on the tool name: the tool may grow more
 * arguments, but what it takes to reverse a given row does not change once it
 * is written. That also means an action recorded by a version of a tool that no
 * longer exists is still reversible.
 */
export async function applyUndo(supabase, { undo }) {
  assertLearnerClient(supabase)

  const kind = undo?.kind

  if (kind === 'restore_course_title') {
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

  if (kind === 'remove_course') {
    unwrap(
      await supabase.from('subjects').delete().eq('id', undo.courseId),
      'take the course back',
    )
    return { undone: 'create_course' }
  }

  if (kind === 'remove_artefacts') {
    unwrapList(
      await supabase.from('artefacts').delete().in('id', undo.ids ?? []).select('id'),
      'take the artefacts back',
    )
    return { undone: 'make_artefacts', removed: (undo.ids ?? []).length }
  }

  if (kind === 'restore_artefact') {
    await updateArtefact(supabase, { id: undo.artefactId, payload: undo.payload })
    return { undone: 'edit_artefact' }
  }

  if (kind === 'move_artefacts_back') {
    for (const [subjectId, group] of Object.entries(undo.previous ?? {})) {
      await moveArtefacts(supabase, {
        ids: group,
        subjectId: subjectId === 'none' ? null : subjectId,
      })
    }
    return { undone: 'move_tasks' }
  }

  if (kind === 'restore_artefacts') {
    await restoreArtefacts(supabase, { ids: undo.ids ?? [] })
    return { undone: 'archive_tasks' }
  }

  if (kind === 'archive_artefacts') {
    await archiveArtefacts(supabase, { ids: undo.ids ?? [] })
    return { undone: 'restore_tasks' }
  }

  if (kind === 'restore_source') {
    await restoreSource(supabase, { id: undo.sourceId })
    return { undone: 'archive_source' }
  }

  if (kind === 'archive_source') {
    await archiveSource(supabase, { id: undo.sourceId })
    return { undone: 'add_material' }
  }

  if (kind === 'reschedule_back') {
    for (const group of undo.groups ?? []) {
      await rescheduleArtefacts(supabase, { ids: group.ids, dueAt: group.dueAt })
    }
    return { undone: 'reschedule_tasks' }
  }

  if (kind === 'remove_review') {
    unwrapList(
      await supabase.from('reviews').delete().eq('id', undo.id).select('id'),
      'take the review back',
    )
    return { undone: 'record_review' }
  }

  if (kind === 'remove_standing_order') {
    unwrap(
      await supabase.from('standing_orders').delete().eq('id', undo.id),
      'take the standing order back',
    )
    return { undone: 'create_standing_order' }
  }

  if (kind === 'restore_standing_order') {
    await updateStandingOrder(supabase, {
      id: undo.id,
      instruction: undo.instruction,
      schedule: undo.schedule,
      enabled: undo.enabled,
    })
    return { undone: 'set_standing_order' }
  }

  throw new Error('That action cannot be undone.')
}

/* --- the catalogue ---------------------------------------------------- */

/**
 * Bind the writing tools to one run.
 *
 * `runId` is closed over, not passed through the model. An action attributed
 * to a run the model chose would be an audit trail the model can edit. The same
 * goes for `userId`, the client and the intent sink.
 *
 * @param {object} supabase the request-scoped client
 * @param {object} context
 * @param {string} context.userId
 * @param {string} context.runId
 * @param {object} [context.client] the structured client, for generation
 * @param {(intent: object) => void} [context.onIntent] where intents are collected
 * @param {string[]} [context.only] bind a subset, by name — this is how a role
 *   gets fewer tools than the whole surface
 */
export function writeTools(supabase, { userId, runId, client, onIntent, only } = {}) {
  const chosen = only ? WRITE_TOOLS.filter((definition) => only.includes(definition.name)) : WRITE_TOOLS

  return chosen.map((definition) =>
    tool({
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
      execute: (input) =>
        definition.run(supabase, { ...(input ?? {}), userId, runId, client, onIntent }),
    }),
  )
}

const nullableId = (what) => z.string().nullable().describe(what)

/**
 * A payload arrives as serialised JSON, not as an object.
 *
 * The six formats have six different shapes, and the SDK's strict structured
 * outputs need one closed schema per parameter — there is no "an object, shape
 * depending". A string the tool parses keeps all six reachable through one
 * tool, and `validatePayload` is what actually judges the result either way.
 */
function parsePayload(text) {
  if (text && typeof text === 'object') return text

  try {
    const parsed = JSON.parse(String(text ?? ''))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    return parsed
  } catch {
    throw new Error(
      'The payload has to be a JSON object, given as a string — for a flashcard, {"front": "…", "back": "…"}.',
    )
  }
}

export const WRITE_TOOLS = [
  {
    name: 'create_course',
    description:
      'Create a course to file material under. Use this when the learner names a course that list_courses does not show. It can be taken back.',
    parameters: z.object({
      title: z.string().describe('What to call it.'),
    }),
    run: (supabase, input) => createCourseTool(supabase, input),
  },
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
    name: 'add_material',
    description:
      'File pasted text as a source under a course, cut into sections with anchors. Nothing is generated from it — do that with make_artefacts afterwards if the learner asked for it. The course is created if it does not exist.',
    parameters: z.object({
      course: z.string().describe('The course to file it under, by name.'),
      title: z.string().describe('What to call this source.'),
      text: z.string().describe('The material itself.'),
    }),
    run: (supabase, input) => addMaterialTool(supabase, input),
  },
  {
    name: 'archive_source',
    description:
      'Archive a source, so it leaves the course shelf. Its sections, concepts and tasks stay where they are; nothing is deleted, and the learner can restore it.',
    parameters: z.object({
      sourceId: z.string().describe('The source to archive.'),
    }),
    run: (supabase, input) => archiveSourceTool(supabase, input),
  },
  {
    name: 'restore_source',
    description: 'Put an archived source back on the course shelf.',
    parameters: z.object({
      sourceId: z.string().describe('The source to restore.'),
    }),
    run: (supabase, input) => restoreSourceTool(supabase, input),
  },
  {
    name: 'make_artefacts',
    description: `Generate from one passage of the learner’s material — a task (flashcard, cloze, multiple_choice, open_question) or reading (summary, glossary). Pass a format to choose, or omit it to let the format follow the passage. At most ${MAX_ARTEFACTS} per call, and each one is a model call the learner pays for. Check list_tasks first so you do not make a second copy of what is already there.`,
    parameters: z.object({
      sectionId: z.string().describe('The passage to generate from.'),
      format: nullableId(`One of ${FORMATS.join(', ')}, or null to let the passage decide.`),
      count: z.number().describe(`How many to make, 1 to ${MAX_ARTEFACTS}.`),
    }),
    run: (supabase, input) => makeArtefacts(supabase, input),
  },
  {
    name: 'write_artefact',
    description:
      'Write one task or one piece of reading by hand, with no model call and no cost. Use this when you already know exactly what it should say — correcting a card, or writing one the learner dictated.',
    parameters: z.object({
      subjectId: z.string().describe('The course it belongs to.'),
      sectionId: nullableId('The passage it comes from, or null if it cites nothing.'),
      format: z.string().describe(`One of ${FORMATS.join(', ')}.`),
      payload: z
        .string()
        .describe(
          'The artefact itself as a JSON object, serialised — for a flashcard, {"front": "…", "back": "…"}.',
        ),
    }),
    run: (supabase, input) =>
      writeArtefact(supabase, { ...input, payload: parsePayload(input.payload) }),
  },
  {
    name: 'edit_artefact',
    description:
      'Rewrite the contents of one existing task or piece of reading. The format cannot change. The previous version is kept so the learner can undo this.',
    parameters: z.object({
      artefactId: z.string().describe('The one to edit.'),
      payload: z
        .string()
        .describe('The new contents as a JSON object, serialised, in the shape the format requires.'),
    }),
    run: (supabase, input) =>
      editArtefact(supabase, { ...input, payload: parsePayload(input.payload) }),
  },
  {
    name: 'move_tasks',
    description:
      'Move tasks or reading to another course, in bulk. Where each one came from is remembered individually, so this can be undone even across a mixed selection.',
    parameters: z.object({
      ids: z.array(z.string()).describe('The artefacts to move.'),
      subjectId: z.string().describe('The course to move them to.'),
    }),
    run: (supabase, input) => moveTasks(supabase, input),
  },
  {
    name: 'archive_tasks',
    description:
      'Archive tasks or reading in bulk — duplicates, or work the learner is done with. Nothing is deleted: archived things go to the archive and can be restored.',
    parameters: z.object({
      ids: z.array(z.string()).describe('The artefacts to archive.'),
    }),
    run: (supabase, input) => archiveTasks(supabase, input),
  },
  {
    name: 'restore_tasks',
    description: 'Bring tasks or reading back out of the archive.',
    parameters: z.object({
      ids: z.array(z.string()).describe('The artefacts to restore.'),
    }),
    run: (supabase, input) => restoreTasks(supabase, input),
  },
  {
    name: 'reschedule_tasks',
    description:
      'Push tasks out to a new due date, in bulk — for a holiday, or to spread a queue that has piled up. The grading history is untouched; only the next date moves.',
    parameters: z.object({
      ids: z.array(z.string()).describe('The tasks to reschedule.'),
      dueAt: z.string().describe('The new due date, as an ISO 8601 timestamp.'),
    }),
    run: (supabase, input) => rescheduleTasks(supabase, input),
  },
  {
    name: 'record_review',
    description:
      'Record how the learner did on one task: 1 again, 2 hard, 3 good, 4 easy. This is what moves mastery and sets the next due date, so record only what the learner actually answered.',
    parameters: z.object({
      artefactId: z.string().describe('The task that was answered.'),
      rating: z.number().describe('1 again, 2 hard, 3 good, 4 easy.'),
    }),
    run: (supabase, input) => recordReviewTool(supabase, input),
  },
  {
    name: 'grade_answer',
    description:
      'Judge a free-text answer against the question’s criteria and say what was missing. Changes nothing on its own — follow it with record_review to write the evidence down.',
    parameters: z.object({
      question: z
        .object({
          prompt: z.string(),
          model_answer: z.string(),
          criteria: z.array(z.string()),
        })
        .describe('The open question, as list_tasks returned it.'),
      answer: z.string().describe('What the learner wrote.'),
    }),
    run: (supabase, input) => gradeAnswerTool(supabase, input),
  },
  {
    name: 'show_in_interface',
    description:
      'Take the learner to where something is: a course, the task workbench set to a course and a type, a review round, or analytics on one concept. Use it after you have made something, so they land on it rather than having to look for it.',
    parameters: z.object({
      target: z
        .string()
        .describe('One of dashboard, courses, course, tasks, due, analytics.'),
      courseId: nullableId('Sets the course picker, or null.'),
      format: nullableId('Opens one task type, or null.'),
      sourceId: nullableId('Filters to one source, or null.'),
      sectionId: nullableId('Filters to one passage, or null.'),
      conceptId: nullableId('Opens analytics on one concept, or null.'),
    }),
    run: (supabase, input) => showInInterface(supabase, input),
  },
  {
    name: 'create_standing_order',
    description:
      'Write a standing instruction the agent carries out on a schedule with the learner not present — "top up any concept below half mastery", weekly. Its report lands as a message in a thread.',
    parameters: z.object({
      instruction: z.string().describe('What to do, in full, as if nobody were there to ask.'),
      schedule: z
        .string()
        .describe('How often: daily, weekly, monthly, or "every 3 days".'),
    }),
    run: (supabase, input) => createStandingOrderTool(supabase, input),
  },
  {
    name: 'set_standing_order',
    description:
      'Change a standing order or switch it off. Use list_standing_orders for the id. The previous version is kept so the learner can undo this.',
    parameters: z.object({
      standingOrderId: z.string().describe('The order to change.'),
      instruction: z.string().nullable().describe('New instruction, or null to keep it.'),
      schedule: z.string().nullable().describe('New schedule, or null to keep it.'),
      enabled: z.boolean().nullable().describe('Switch it on or off, or null to keep it.'),
    }),
    run: (supabase, input) =>
      setStandingOrder(supabase, {
        ...input,
        instruction: input.instruction ?? undefined,
        schedule: input.schedule ?? undefined,
        enabled: input.enabled ?? undefined,
      }),
  },
]

/** The names, for a role that takes a subset. */
export const WRITE_TOOL_NAMES = Object.freeze(WRITE_TOOLS.map((definition) => definition.name))
