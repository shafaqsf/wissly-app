import { unwrapList } from './result.js'

/* What the weekly report needs, read from tables and views that already
 * exist — `reviews`, `concept_mastery` (003), `artefact_schedule` (004).
 * Nothing here depends on the momentum or analytics branches; where their
 * data would sharpen a number, `src/lib/notifications/weekly-report.js`
 * says so in the report's own `todos`, not here. */

const DAY_MS = 24 * 60 * 60 * 1000
const STREAK_WINDOW_DAYS = 60
const PERIOD_DAYS = 7

function toDate(value) {
  return value instanceof Date ? value : new Date(value)
}

/** Consecutive UTC calendar days with at least one review, counting back from `now`. */
function streakEndingToday(reviewedAtList, now) {
  const days = new Set(reviewedAtList.map((iso) => toDate(iso).toISOString().slice(0, 10)))

  let streak = 0
  // A clone, deliberately: `now` may be the same Date instance the caller
  // still holds onto, and this walks it backwards a day at a time.
  const cursor = new Date(toDate(now).getTime())
  cursor.setUTCHours(0, 0, 0, 0)

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  return streak
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{userId: string, now?: Date}} options
 * @returns {Promise<{
 *   periodStart: string, periodEnd: string, reviewsDone: number,
 *   ratingCounts: {1: number, 2: number, 3: number, 4: number},
 *   masteryNow: number, masteryBefore: null, streakDays: number,
 *   dueNext7Days: number,
 * }>}
 */
export async function gatherWeeklyReportData(supabase, { now = new Date() } = {}) {
  const end = toDate(now)
  const periodStart = new Date(end.getTime() - PERIOD_DAYS * DAY_MS)
  const streakSince = new Date(end.getTime() - STREAK_WINDOW_DAYS * DAY_MS)
  const dueBy = new Date(end.getTime() + PERIOD_DAYS * DAY_MS)

  const periodReviews = unwrapList(
    await supabase
      .from('reviews')
      .select('rating')
      .gte('reviewed_at', periodStart.toISOString())
      .lt('reviewed_at', end.toISOString()),
    "read this week's reviews",
  )

  const streakReviews = unwrapList(
    await supabase
      .from('reviews')
      .select('reviewed_at')
      .gte('reviewed_at', streakSince.toISOString())
      .lt('reviewed_at', end.toISOString()),
    'read your review history',
  )

  const masteryRows = unwrapList(
    await supabase.from('concept_mastery').select('mastery'),
    'read your progress',
  )

  const dueRows = unwrapList(
    await supabase.from('artefact_schedule').select('artefact_id').lte('next_due_at', dueBy.toISOString()),
    'read your queue',
  )

  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const row of periodReviews) {
    const rating = Number(row.rating)
    if (ratingCounts[rating] !== undefined) ratingCounts[rating] += 1
  }

  const masteryNow =
    masteryRows.length === 0
      ? 0
      : masteryRows.reduce((sum, row) => sum + (Number(row.mastery) || 0), 0) / masteryRows.length

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: end.toISOString(),
    reviewsDone: periodReviews.length,
    ratingCounts,
    masteryNow,
    // No mastery-history table exists yet to read a start-of-period snapshot
    // from — see the TODO `buildWeeklyReport` attaches to the report itself.
    masteryBefore: null,
    streakDays: streakEndingToday(
      streakReviews.map((row) => row.reviewed_at),
      end,
    ),
    dueNext7Days: dueRows.length,
  }
}
