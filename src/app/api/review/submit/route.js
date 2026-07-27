import { revalidatePath } from 'next/cache'

import { currentUserId } from '@/lib/auth/user.js'
import { fsrsState, recordReview, scheduleFor } from '@/lib/data/review.js'
import { createClient } from '@/lib/supabase/server.js'

/**
 * The other half of `flushPendingReviews` — a rating queued offline, and
 * (also) a rating the online path could reach directly. It mirrors
 * `rateArtefactAction` in src/lib/actions/review.js rather than sharing code
 * with it because a Route Handler and a server action take their input
 * differently; the underlying writes are the same two calls.
 */

export const runtime = 'nodejs'

function json(body, status = 200) {
  return Response.json(body, { status })
}

export async function POST(request) {
  const supabase = await createClient()

  const userId = await currentUserId(supabase)
  if (!userId) return json({ error: 'Sign in first.' }, 401)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'That was not readable as JSON.' }, 400)
  }

  const { artefactId, rating } = body ?? {}
  if (!Number.isInteger(rating) || rating < 1 || rating > 4) {
    return json({ error: 'rating must be an integer from 1 to 4.' }, 400)
  }

  const schedule = await scheduleFor(supabase, { artefactId })
  if (!schedule) {
    return json({ error: 'That task is gone.' }, 404)
  }

  const review = await recordReview(supabase, {
    userId,
    artefactId,
    rating,
    state: fsrsState(schedule),
  })

  revalidatePath('/tasks', 'layout')
  revalidatePath('/analytics')
  revalidatePath('/dashboard')

  return json({ dueAt: review.due_at })
}
