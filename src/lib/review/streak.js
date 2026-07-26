/**
 * Streaks — consecutive days with at least one completed review.
 *
 * Pure, like `fsrs.js`: timestamps in, a day count out. Computed fresh from
 * `reviews.reviewed_at` rather than kept in a counter column. A counter is a
 * second place the same fact would live, and it drifts the moment one write
 * path updates it and another does not — a backfilled review, an undone
 * rating, a review recorded by a future import path this file never sees.
 * The event log is already the source of truth for everything else FSRS
 * touches; reading it here costs one bounded query
 * (`src/lib/data/streak.js`), not a write on every rating.
 */

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(value) {
  const date = new Date(value)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function dayKey(value) {
  return startOfDay(value).toISOString().slice(0, 10)
}

/**
 * The length, in days, of the run of consecutive days carrying at least one
 * review, ending today or yesterday.
 *
 * A day with nothing reviewed *yet* does not break the streak until it is
 * over: reviewing yesterday and nothing so far today still reads as an alive
 * streak, because there is still time today to extend it. Nothing yesterday
 * either means the run already broke.
 *
 * @param {Array<string|Date>} reviewedAt timestamps of completed reviews, any order
 * @param {Date|string} [now]
 * @returns {number} whole days; 0 if there is no history or the run is broken
 */
export function currentStreak(reviewedAt = [], now = new Date()) {
  const days = new Set(reviewedAt.map(dayKey))
  if (days.size === 0) return 0

  const today = startOfDay(now)
  const yesterday = new Date(today.getTime() - DAY_MS)

  let cursor = days.has(dayKey(today)) ? today : yesterday
  if (!days.has(dayKey(cursor))) return 0

  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak += 1
    cursor = new Date(cursor.getTime() - DAY_MS)
  }

  return streak
}

/** Milestones worth naming. Not an achievement catalogue, just the marks a learner notices. */
export const STREAK_MILESTONES = Object.freeze([7, 30, 100])

/** The highest milestone a streak of this length has reached, or null. */
export function streakMilestone(streak) {
  const reached = STREAK_MILESTONES.filter((milestone) => streak >= milestone)
  return reached.length ? reached[reached.length - 1] : null
}
