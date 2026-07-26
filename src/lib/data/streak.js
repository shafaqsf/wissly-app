import { currentStreak, streakMilestone } from '../review/streak.js'
import { unwrapList } from './result.js'

/* The learner's current streak, read from the review log.
 *
 * Deliberately not a counter column maintained on every insert into
 * `reviews`. A counter is a second place the same fact lives, and the moment
 * one write path updates `reviews` without also touching the counter — an
 * undo, a backfill, a future import — the number on screen and the log it is
 * supposed to summarise disagree, silently. Reading `reviewed_at` back and
 * folding it with `currentStreak` costs one bounded query; see
 * `src/lib/review/streak.js` for the pure logic.
 *
 * The lookback window exists only to keep the query bounded. A year is far
 * longer than any streak worth showing, so nothing a learner could reach
 * falls outside it. */

const LOOKBACK_DAYS = 400
const DAY_MS = 24 * 60 * 60 * 1000

export async function streakFor(supabase, { now = new Date() } = {}) {
  const since = new Date(new Date(now).getTime() - LOOKBACK_DAYS * DAY_MS)

  const rows = unwrapList(
    await supabase
      .from('reviews')
      .select('reviewed_at')
      .gte('reviewed_at', since.toISOString()),
    'read your review history',
  )

  const days = currentStreak(
    rows.map((row) => row.reviewed_at),
    now,
  )

  return { days, milestone: streakMilestone(days) }
}
