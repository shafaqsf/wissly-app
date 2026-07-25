'use server'

import { revalidatePath } from 'next/cache'

import { generateArtefacts } from '@/lib/agent/artefacts.js'
import { isTaskFormat, validatePayload } from '@/lib/agent/formats.js'
import { createOpenRouterClient, openRouterConfigFromEnv } from '@/lib/agent/openrouter.js'
import { requireUserId } from '@/lib/auth/user.js'
import {
  archiveArtefacts,
  createArtefact,
  moveArtefacts,
  rescheduleArtefacts,
  restoreArtefacts,
  saveArtefacts,
  sectionsWithFormat,
  updateArtefact,
} from '@/lib/data/artefacts.js'
import { createClient } from '@/lib/supabase/server.js'

/* What the workbench calls.
 *
 * Two ways in, and they are deliberately asymmetric. Writing one costs
 * nothing and reaches no model at all — the payload is assembled from the form
 * and checked against the format's own schema before a row is written.
 * Generating spends one model call per section, and the surface has already
 * said how many that is and which sections already carry this type.
 *
 * Nothing here deletes. Everything that removes is `archived_at`, so an
 * accidental bulk archive of two hundred cards is one bulk restore away.
 *
 * Export is not here and never will be: it is the one path that carries data
 * out of the account, so the learner triggers it in the browser and no tool
 * can reach it. */

/** A comma-separated list of ids, as a selection arrives from the browser. */
function idsFrom(formData, field = 'ids') {
  return String(formData.get(field) ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

function text(formData, field) {
  return String(formData.get(field) ?? '').trim()
}

/** Four types, four shapes. The one place a form becomes a payload. */
function payloadFrom(format, formData) {
  if (format === 'flashcard') {
    return { front: text(formData, 'front'), back: text(formData, 'back') }
  }

  if (format === 'cloze') {
    return { text: text(formData, 'text'), answer: text(formData, 'answer') }
  }

  if (format === 'multiple_choice') {
    // The options are numbered rather than repeated, so a blank one is an
    // empty box in a known position and not a silently shorter list.
    const options = []
    const rationales = []

    for (let index = 0; formData.has(`option-${index}`); index += 1) {
      options.push(text(formData, `option-${index}`))
      rationales.push(text(formData, `rationale-${index}`))
    }

    return {
      stem: text(formData, 'stem'),
      options,
      answer_index: Number(text(formData, 'answer_index') || 0),
      rationales,
    }
  }

  return {
    prompt: text(formData, 'prompt'),
    model_answer: text(formData, 'model_answer'),
    criteria: text(formData, 'criteria')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  }
}

/** The payload, or the reason it is not one yet. */
function checked(format, formData) {
  const payload = payloadFrom(format, formData)
  const { valid, errors } = validatePayload(format, payload)

  return valid ? { payload } : { message: `That card is not usable yet — ${errors.join('; ')}.` }
}

/** Every surface that could be looking at what just changed. */
function refresh(subjectId) {
  revalidatePath('/tasks', 'layout')
  revalidatePath('/analytics')
  revalidatePath('/dashboard')
  if (subjectId) revalidatePath(`/courses/${subjectId}`)
}

/**
 * Write one by hand. No model, no cost, `origin: 'manual'` — which is what
 * lets the interface say whether the learner wrote this card or the agent did.
 */
export async function createTaskAction(previousState, formData) {
  const format = text(formData, 'format')

  if (!isTaskFormat(format)) {
    return { message: 'That is not a task type.' }
  }

  const subjectId = text(formData, 'subjectId') || null
  const { payload, message } = checked(format, formData)

  if (message) return { message }

  const supabase = await createClient()
  const userId = await requireUserId(supabase)

  try {
    await createArtefact(supabase, {
      userId,
      subjectId,
      sectionId: text(formData, 'sectionId') || null,
      conceptId: text(formData, 'conceptId') || null,
      format,
      payload,
      origin: 'manual',
    })
  } catch (error) {
    return { message: error.message }
  }

  refresh(subjectId)

  return { message: 'Saved.', done: true }
}

/** Edit one. The format is not editable — a cloze does not become a question. */
export async function updateTaskAction(previousState, formData) {
  const format = text(formData, 'format')
  const id = text(formData, 'id')

  if (!id) return { message: 'That card is gone. Reload the list.' }
  if (!isTaskFormat(format)) return { message: 'That is not a task type.' }

  const { payload, message } = checked(format, formData)

  if (message) return { message }

  const supabase = await createClient()
  await requireUserId(supabase)

  try {
    await updateArtefact(supabase, { id, payload })
  } catch (error) {
    return { message: error.message }
  }

  refresh(text(formData, 'subjectId'))

  return { message: 'Saved.', done: true }
}

/* The bulk verbs. Each is one statement over the whole selection: a loop would
 * be one round trip per row and would half-apply on a failure. */

export async function archiveTasksAction(formData) {
  const ids = idsFrom(formData)
  if (ids.length === 0) return

  const supabase = await createClient()
  await requireUserId(supabase)

  await archiveArtefacts(supabase, { ids })
  refresh(text(formData, 'subjectId'))
}

export async function restoreTasksAction(formData) {
  const ids = idsFrom(formData)
  if (ids.length === 0) return

  const supabase = await createClient()
  await requireUserId(supabase)

  await restoreArtefacts(supabase, { ids })
  refresh(text(formData, 'subjectId'))
}

export async function moveTasksAction(formData) {
  const ids = idsFrom(formData)
  const subjectId = text(formData, 'subjectId')
  if (ids.length === 0 || !subjectId) return

  const supabase = await createClient()
  await requireUserId(supabase)

  await moveArtefacts(supabase, { ids, subjectId })
  refresh(subjectId)
}

export async function rescheduleTasksAction(formData) {
  const ids = idsFrom(formData)
  const dueAt = text(formData, 'dueAt')
  if (ids.length === 0 || !dueAt) return

  const supabase = await createClient()
  await requireUserId(supabase)

  await rescheduleArtefacts(supabase, { ids, dueAt })
  refresh(text(formData, 'courseId'))
}

/**
 * Which of these sections already carry this type.
 *
 * Asked before the click that spends, not after: manual and agent creation
 * reach the same sections, and a learner who generates twice over section 3
 * pays twice for two cards saying the same thing.
 */
export async function sectionsWithFormatAction({ format, sectionIds, subjectId }) {
  const supabase = await createClient()
  await requireUserId(supabase)

  return sectionsWithFormat(supabase, {
    format,
    ...(sectionIds ? { sectionIds } : {}),
    ...(subjectId ? { subjectId } : {}),
  })
}

/**
 * Generate this type from the sections that were chosen.
 *
 * One model call per section, and the surface has already shown that number.
 * `collectFailures` is on because a long document always holds a section the
 * model can do nothing with, and losing the other eleven to it would be worse
 * than reporting the one.
 */
export async function generateTasksAction(previousState, formData) {
  const format = text(formData, 'format')
  const subjectId = text(formData, 'subjectId') || null
  const sectionIds = idsFrom(formData, 'sectionIds')

  if (!isTaskFormat(format)) return { message: 'That is not a task type.' }
  if (sectionIds.length === 0) {
    return { message: 'Choose at least one section to generate from.' }
  }

  const supabase = await createClient()
  const userId = await requireUserId(supabase)

  const { data, error } = await supabase
    .from('sections')
    .select('id, ordinal, content, anchor')
    .in('id', sectionIds)

  if (error) return { message: 'Your material could not be read. Try again.' }

  const sections = data ?? []
  if (sections.length === 0) {
    return { message: 'Those sections are gone. Reload the page.' }
  }

  let result

  try {
    result = await generateArtefacts({
      client: createOpenRouterClient(openRouterConfigFromEnv()),
      sections,
      format,
      subjectId,
      collectFailures: true,
    })
  } catch (error) {
    return { message: error.message }
  }

  const { artefacts, failures } = result

  try {
    await saveArtefacts(supabase, {
      userId,
      artefacts: artefacts.map((artefact) => ({ ...artefact, subject_id: subjectId })),
      origin: 'agent',
    })
  } catch (error) {
    return { message: error.message }
  }

  refresh(subjectId)

  return { message: summarise({ format, artefacts, failures, sections }), done: true }
}

const NOUNS = {
  flashcard: 'flashcard',
  cloze: 'cloze',
  multiple_choice: 'multiple choice question',
  open_question: 'open question',
}

function summarise({ format, artefacts, failures, sections }) {
  const parts = [
    `Wrote ${count(artefacts.length, NOUNS[format])} from ${count(sections.length, 'section')}.`,
  ]

  if (failures.length > 0) {
    parts.push(
      `${count(failures.length, 'section')} could not be written from. Choose those again to retry.`,
    )
  }

  return parts.join(' ')
}

function count(amount, noun) {
  return `${amount} ${noun}${amount === 1 ? '' : 's'}`
}
