'use server'

import { revalidatePath } from 'next/cache'

import { requireUserId } from '@/lib/auth/user.js'
import { reviewLogFor, saveWeights, weightsFor } from '@/lib/data/fsrs-weights.js'
import { MIN_REVIEWS_TO_FIT, fitWeights } from '@/lib/review/fit-weights.js'
import { createClient } from '@/lib/supabase/server.js'

/**
 * "Recompute my weights" — the on-demand action the settings screen calls.
 *
 * There is no nightly job, on purpose: fitting is a `select` and a search
 * over the review log, not a service that needs to exist between visits, and
 * a learner who has not reviewed anything new since the last fit would only
 * be paying the same computation twice for the same answer.
 */
export async function recomputeWeightsAction(_previousState, _formData) {
  const supabase = await createClient()
  const userId = await requireUserId(supabase)

  const reviews = await reviewLogFor(supabase)

  if (reviews.length < MIN_REVIEWS_TO_FIT) {
    return {
      message:
        `Not enough review history yet to fit your own schedule — ` +
        `that needs at least ${MIN_REVIEWS_TO_FIT} reviews, and you have ${reviews.length}. ` +
        `Keep answering tasks and try again later.`,
    }
  }

  const existing = await weightsFor(supabase)
  const fit = fitWeights(reviews, { initialWeights: existing?.weights })

  if (!fit.improved) {
    return {
      message:
        `Fitted against ${fit.reviewCount} reviews, but the published defaults already ` +
        `explain your recall as well as anything the search found — nothing changed.`,
    }
  }

  await saveWeights(supabase, {
    userId,
    weights: fit.weights,
    reviewCount: fit.reviewCount,
    loss: fit.loss,
  })

  revalidatePath('/settings')

  return {
    fitted: true,
    message:
      `Refitted from ${fit.reviewCount} reviews. Average log-loss moved from ` +
      `${fit.startingLoss.toFixed(3)} to ${fit.loss.toFixed(3)} — lower means the curve ` +
      `matches your own recall better than the published defaults did.`,
  }
}
