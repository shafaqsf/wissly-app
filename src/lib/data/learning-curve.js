import { dayOf, windowOf } from './agent-runs.js'
import { unwrapList } from './result.js'

/**
 * Recall over time — what the learning-curve chart draws.
 *
 * `concept_mastery` (migration 003) collapses every artefact to its *most
 * recent* review, on purpose: that is the right question for "how well do I
 * know this right now". A learning curve asks the other question — "how has
 * that changed" — so this reads every review in the window instead of only
 * the latest, and buckets by the day it happened.
 *
 * Each day's score is the mean of `(rating - 1) / 3` over that day's
 * reviews, the same linear mapping `concept_mastery` uses, so the chart and
 * the grain field it sits beside are reading the same scale. A day with no
 * reviews is `null`, not `0` — an untouched day and a day of clean misses are
 * different facts, exactly as `day-bars.jsx` already treats them for the
 * review-count chart.
 */
export async function recallOverTime(
  supabase,
  { subjectId, conceptId, days = 60, now = new Date() } = {},
) {
  if (!subjectId && !conceptId) return []

  const artefactQuery = conceptId
    ? supabase.from('artefacts').select('id').eq('concept_id', conceptId)
    : supabase.from('artefacts').select('id').eq('subject_id', subjectId)

  const artefacts = unwrapList(await artefactQuery, 'find what to chart')
  const artefactIds = artefacts.map((row) => row.id)

  if (artefactIds.length === 0) return []

  const window = windowOf(days, now)

  const reviews = unwrapList(
    await supabase
      .from('reviews')
      .select('rating, reviewed_at')
      .in('artefact_id', artefactIds)
      .gte('reviewed_at', window[0].toISOString())
      .order('reviewed_at', { ascending: true }),
    'read the review history',
  )

  const buckets = new Map(
    window.map((day) => [dayOf(day), { date: dayOf(day), reviews: 0, total: 0 }]),
  )

  for (const review of reviews) {
    const bucket = buckets.get(dayOf(review.reviewed_at))
    if (!bucket) continue

    bucket.reviews += 1
    bucket.total += (Number(review.rating) - 1) / 3
  }

  return [...buckets.values()].map((bucket) => ({
    date: bucket.date,
    reviews: bucket.reviews,
    recall: bucket.reviews > 0 ? bucket.total / bucket.reviews : null,
  }))
}
