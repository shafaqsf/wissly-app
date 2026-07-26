/**
 * The adaptive daily goal — how many reviews to do today to stay on track.
 *
 * Pure, like `fsrs.js` and `streak.js`: counts in, a target out. "On track"
 * means spreading everything due before the horizon evenly across the days
 * left, so a pile that accumulated over a weekend does not all land on
 * Monday. It adapts on every read rather than being decided once: finish a
 * review and `totalDue` drops, so the same call made a minute later asks for
 * one less; let a day pass without opening the app and the horizon shrinks
 * while the total does not, so the daily number rises to compensate.
 *
 * The horizon is the exam date when a course has one, and a fixed lookahead
 * otherwise — there being nothing else to plan against, a week is long
 * enough to smooth day-to-day noise and short enough that the number still
 * means "soon".
 */

export const DEFAULT_HORIZON_DAYS = 7

/**
 * @param {object} options
 * @param {number} options.totalDue reviews due on or before the horizon
 * @param {number} options.daysRemaining whole days left, at least 1
 * @param {number} [options.completedToday=0] reviews already done today
 * @returns {{target: number, remaining: number, horizonDays: number}}
 */
export function suggestDailyGoal({ totalDue, daysRemaining, completedToday = 0 }) {
  const horizonDays = Math.max(1, Math.round(daysRemaining))
  const due = Math.max(0, Number(totalDue) || 0)
  const done = Math.max(0, Number(completedToday) || 0)

  const target = Math.ceil(due / horizonDays)
  const remaining = Math.max(target - done, 0)

  return { target, remaining, horizonDays }
}
