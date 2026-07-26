import { retrievability } from './fsrs.js'

/**
 * The compressed review plan — a day-by-day list of what to review so a
 * course is maximally prepared by its exam date.
 *
 * Pure, and built on `fsrs.js` rather than beside it: how likely an artefact
 * is to still be remembered on exam day is exactly `retrievability`, called
 * with the days between the artefact's last review and the exam instead of
 * "now". Nothing here re-derives the forgetting curve.
 *
 * The plan does not simply keep every artefact's own FSRS due date. Two
 * things push it to compress instead:
 *
 * - An artefact due after the exam is still worth a pass before it, because
 *   the exam is what it needs to survive until, not the scheduler's guess at
 *   when forgetting becomes likely.
 * - A pile due before the exam that exceeds what a learner can plausibly do
 *   in one sitting has to spread across the days available, front-loaded
 *   with whatever will have decayed the most by exam day — reviewing the
 *   shakiest material first leaves it the most time to be reinforced again
 *   before it counts.
 */

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(value) {
  const date = new Date(value)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function isoDay(date) {
  return date.toISOString().slice(0, 10)
}

function daysBetweenInclusive(start, end) {
  const days = []
  for (let day = new Date(start); day <= end; day = new Date(day.getTime() + DAY_MS)) {
    days.push(new Date(day))
  }
  return days
}

function clampDate(date, low, high) {
  if (date < low) return low
  if (date > high) return high
  return date
}

/**
 * @param {object} options
 * @param {Array<{artefactId: string, stability?: number, dueAt?: string|Date,
 *   lastReviewedAt?: string|Date}>} options.schedule every recall artefact in the course
 * @param {string|Date} options.examDate
 * @param {string|Date} [options.now]
 * @returns {Array<{date: string, count: number, artefactIds: string[]}>}
 *   one entry per day from today to the exam, oldest first
 */
export function compressedPlan({ schedule = [], examDate, now = new Date() }) {
  const start = startOfDay(now)
  const end = startOfDay(examDate)

  // An exam that has already passed, or is today, still gets one day: cramming
  // everything into the day you have left is the honest answer, not an empty plan.
  const days = end < start ? [start] : daysBetweenInclusive(start, end)

  if (schedule.length === 0) {
    return days.map((day) => ({ date: isoDay(day), count: 0, artefactIds: [] }))
  }

  const capacity = Math.max(1, Math.ceil(schedule.length / days.length))
  const planEnd = days[days.length - 1]

  const scored = schedule.map((item) => {
    const hasState = item.stability != null
    const reference = item.lastReviewedAt ?? item.dueAt ?? now
    const elapsedAtExam = Math.max((planEnd - new Date(reference)) / DAY_MS, 0)
    // Never reviewed reads as 0 % retrievability: there is nothing to decay
    // from, and it is exactly as urgent as something already forgotten.
    const predictedRetrievability = hasState ? retrievability(elapsedAtExam, item.stability) : 0
    const naturalDay = clampDate(startOfDay(item.dueAt ?? now), start, planEnd)

    return { ...item, predictedRetrievability, naturalDay }
  })

  // Weakest by exam day first, so a pile that has to compress keeps the
  // shakiest material earliest, leaving the most runway to reinforce it.
  scored.sort((a, b) => a.predictedRetrievability - b.predictedRetrievability)

  const buckets = days.map((day) => ({ date: isoDay(day), items: [] }))
  const indexOfDay = new Map(days.map((day, index) => [isoDay(day), index]))

  for (const item of scored) {
    const naturalIndex = indexOfDay.get(isoDay(item.naturalDay))
    const bucket = buckets[naturalIndex]

    const target =
      bucket.items.length < capacity
        ? bucket
        : (buckets.find((candidate) => candidate.items.length < capacity) ??
          buckets[buckets.length - 1])

    target.items.push(item.artefactId)
  }

  return buckets.map((bucket) => ({
    date: bucket.date,
    count: bucket.items.length,
    artefactIds: bucket.items,
  }))
}
