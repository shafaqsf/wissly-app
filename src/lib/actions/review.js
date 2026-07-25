'use server'

import { revalidatePath } from 'next/cache'

import { gradeAnswer } from '@/lib/agent/artefacts.js'
import { createOpenRouterClient, openRouterConfigFromEnv } from '@/lib/agent/openrouter.js'
import { requireUserId } from '@/lib/auth/user.js'
import { fsrsState, recordReview, scheduleFor } from '@/lib/data/review.js'
import { createClient } from '@/lib/supabase/server.js'

/* What the queue calls. Both of these are reached from a client component,
 * so both re-read the state they act on rather than trusting what the browser
 * sent: a rating is only meaningful against the state the database holds. */

export async function rateArtefactAction({ artefactId, rating }) {
  const supabase = await createClient()
  const userId = await requireUserId(supabase)

  // Not the state the queue was rendered with — that was fetched before the
  // learner started, and a second tab may have answered this one since.
  const schedule = await scheduleFor(supabase, { artefactId })

  if (!schedule) {
    return { message: 'That task is gone. Reload the queue.' }
  }

  const review = await recordReview(supabase, {
    userId,
    artefactId,
    rating,
    state: fsrsState(schedule),
  })

  // The queue moved into the workbench, and so did what it changes: the count
  // on the left of every task surface is the same number this rating moves.
  revalidatePath('/tasks', 'layout')
  revalidatePath('/analytics')
  revalidatePath('/dashboard')

  return { dueAt: review.due_at }
}

export async function gradeAnswerAction({ artefactId, answer }) {
  const supabase = await createClient()
  await requireUserId(supabase)

  const schedule = await scheduleFor(supabase, { artefactId })

  if (!schedule || schedule.format !== 'open_question') {
    return { message: 'That question is gone. Reload the queue.' }
  }

  return gradeAnswer({
    client: createOpenRouterClient(openRouterConfigFromEnv()),
    question: schedule.payload,
    answer,
  })
}
