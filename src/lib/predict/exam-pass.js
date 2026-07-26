/**
 * Exam-pass prediction — a heuristic, and honest about being one.
 *
 * **What this is not**: a validated psychometric instrument. Nothing here
 * has been calibrated against real exam outcomes — this product has no such
 * data and makes no claim to. What it *is*: a deliberately simple, monotonic
 * combination of three things the review log already gives us —
 *
 *   1. average mastery across the course's concepts (the same number the
 *      grain field already renders, just not rounded off to a mark here),
 *   2. how much of the queue has fallen overdue, as a proxy for how stale
 *      that mastery evidence is (mastery is computed from each artefact's
 *      *most recent* review and says nothing about how long ago that was),
 *   3. a bounded, linear projection of further improvement between now and
 *      an optional target date, from the learner's own recent review rate.
 *
 * squeezed through a logistic curve so the result behaves like a
 * probability (rises with mastery, never reaches 0 or 1) without pretending
 * the curve's shape came from data. `STEEPNESS` and `READY_BAR` are chosen
 * so the number *feels* right at the extremes — everything settled reads as
 * confident, everything untouched reads as doubtful — not fitted to
 * anything. Anyone using this to decide whether to reschedule an actual exam
 * should read it as a compass, not an instrument.
 */

import { averageMastery } from '../mastery.js'

/** Average mastery an exam-ready course tends to sit at. Below `MASTERED_AT`
 * on purpose — an exam does not require every concept individually settled,
 * only the average to be comfortably above "still learning". */
const READY_BAR = 0.75

/** How sharply probability responds to distance from `READY_BAR`. Larger is
 * more decisive (a small mastery change moves the number further). */
const STEEPNESS = 8

/** How much projected improvement one review is worth, per concept-day. A
 * small, conservative nudge — this projection is a floor, not a promise. */
const IMPROVEMENT_PER_REVIEW = 0.01

/** However bad the queue looks, do not let staleness alone erase the signal
 * mastery already carries. */
const MAX_STALENESS_PENALTY = 0.15

const clamp = (value, low, high) => Math.min(Math.max(value, low), high)
const sigmoid = (x) => 1 / (1 + Math.exp(-x))

/**
 * @param {object} options
 * @param {Array<{id: string, name: string, mastery: number}>} options.concepts
 * @param {number} [options.overdueFraction] share of the schedulable queue that is overdue right now, in [0, 1]
 * @param {number} [options.reviewsPerDay] recent review rate, reviews/day
 * @param {number|null} [options.daysUntilExam] days left, or null/undefined for "no date given"
 * @param {number} [options.weakLimit] how many driving concepts to name
 * @returns {{probability: number|null, projectedMastery: number|null, drivers: Array}}
 */
export function predictExamPass({
  concepts = [],
  overdueFraction = 0,
  reviewsPerDay = 0,
  daysUntilExam = null,
  weakLimit = 5,
} = {}) {
  if (concepts.length === 0) {
    return { probability: null, projectedMastery: null, drivers: [] }
  }

  const avgMastery = averageMastery(concepts)

  const potentialGain =
    daysUntilExam != null && daysUntilExam > 0
      ? Math.min(Math.max(reviewsPerDay, 0) * daysUntilExam * IMPROVEMENT_PER_REVIEW, 1 - avgMastery)
      : 0

  const projectedMastery = clamp(avgMastery + potentialGain, 0, 1)

  const staleness = clamp(overdueFraction, 0, 1) * MAX_STALENESS_PENALTY

  // Never 0, never 1: mastery is measured from a handful of artefacts per
  // concept, and a number that touches either end would claim a certainty
  // the underlying evidence cannot support.
  const probability = clamp(
    sigmoid(STEEPNESS * (projectedMastery - READY_BAR)) - staleness,
    0.03,
    0.97,
  )

  const drivers = [...concepts]
    .filter((concept) => Number(concept.mastery) < READY_BAR)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, weakLimit)

  return { probability, projectedMastery, drivers }
}

export { READY_BAR }
