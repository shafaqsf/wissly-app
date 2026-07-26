/**
 * Personalised FSRS weight fitting — a separate concern from the scheduler.
 *
 * `fsrs.js` takes a weight vector and knows nothing about where it came
 * from. This module is where one comes from: given a learner's own
 * `reviews` log, replayed events shaped `{ artefact_id, rating,
 * reviewed_at }`, it searches for a 17-number vector that predicts that
 * learner's actual recall better than the published FSRS-4.5 defaults do.
 *
 * Honesty about what this is, because it is easy to oversell an optimizer:
 *
 * - The published FSRS optimizer fits by gradient descent (via autograd)
 *   over review corpora with millions of reviews. This fits one learner's
 *   log, which for most learners will be dozens to low thousands of rows,
 *   by **gradient-free coordinate descent with a shrinking step** (a
 *   pattern search, in the family Hooke–Jeeves belongs to) — no derivative
 *   of `fsrs.js` is taken anywhere, so `fsrs.js` stays a pure function of
 *   state, rating and weights, unaware that fitting exists.
 * - The objective is average log-loss between the FSRS forgetting curve's
 *   predicted retrievability and what actually happened at each review
 *   after the first (`rating === 1` scores as a miss, `2..4` all score as a
 *   recall — the forgetting curve predicts *whether* memory survived, not
 *   how comfortably). A search that reduces this number is provably fitting
 *   *something* real in the log; it is not proof the fit generalises to
 *   reviews that have not happened yet.
 * - `fitWeights` never returns a fit whose loss is worse than where it
 *   started (`loss <= startingLoss`, checked directly in the search: a
 *   step is only taken when it strictly improves the objective), so calling
 *   it is safe even on a small or unusual log — worst case, it changes
 *   nothing.
 */

import { DEFAULT_WEIGHTS, retrievability, scheduleReview } from './fsrs.js'

const PARAM_COUNT = DEFAULT_WEIGHTS.length

/**
 * Loose bounds around the published defaults. Wide enough that a learner's
 * fit can land far from average, narrow enough that the search cannot
 * wander into a region where the forgetting curve stops behaving like one
 * (e.g. a mean-reversion weight outside [0, 1], which would make difficulty
 * diverge instead of settle). Not a research-grade bound table — a
 * pragmatic box around the range the FSRS optimizer community publishes as
 * plausible, index-for-index with `DEFAULT_WEIGHTS`.
 */
export const BOUNDS = Object.freeze([
  [0.1, 15], // w0  initial stability, again
  [0.1, 15], // w1  initial stability, hard
  [0.1, 15], // w2  initial stability, good
  [0.1, 50], // w3  initial stability, easy
  [1, 10], // w4  initial difficulty
  [0.1, 5], // w5  initial difficulty slope
  [0.1, 5], // w6  difficulty step per rating
  [0, 1], // w7  difficulty mean reversion
  [0, 4], // w8  stability growth, exponential term
  [0.01, 1.5], // w9  stability growth, stability exponent
  [0.01, 3], // w10 stability growth, retrievability term
  [0.1, 8], // w11 lapse stability scale
  [0.01, 1], // w12 lapse difficulty exponent
  [0.01, 4], // w13 lapse stability exponent
  [0.01, 4], // w14 lapse retrievability term
  [0.05, 2], // w15 hard penalty
  [0.5, 6], // w16 easy bonus
])

const EPS = 1e-6
const DAY_MS = 86_400_000

/** Every review of one artefact, in the order they happened. */
function byArtefact(reviews) {
  const groups = new Map()

  for (const review of reviews) {
    const list = groups.get(review.artefact_id) ?? []
    list.push(review)
    groups.set(review.artefact_id, list)
  }

  for (const list of groups.values()) {
    list.sort((a, b) => new Date(a.reviewed_at).getTime() - new Date(b.reviewed_at).getTime())
  }

  return [...groups.values()]
}

function clampToBounds(weights) {
  return weights.map((w, i) => Math.min(Math.max(w, BOUNDS[i][0]), BOUNDS[i][1]))
}

/**
 * Average log-loss between FSRS's predicted retrievability and what the
 * learner actually did, replaying every artefact's review sequence forward
 * under `weights`.
 *
 * A review is only scored once it has a predecessor: the first review of an
 * artefact has no prior memory state to predict from, so it seeds the
 * sequence and contributes no loss. Returns `null` when no review in the
 * log has a predecessor at all — nothing here is fittable yet.
 *
 * @param {Array<{artefact_id: string, rating: number, reviewed_at: string}>} reviews
 * @param {number[]} [weights]
 * @returns {number|null}
 */
export function averageLogLoss(reviews, weights = DEFAULT_WEIGHTS) {
  const groups = byArtefact(reviews)
  let total = 0
  let count = 0

  for (const group of groups) {
    let state = null

    for (const review of group) {
      if (state) {
        const last = new Date(state.last_reviewed_at ?? state.due_at).getTime()
        const elapsedDays = Math.max((new Date(review.reviewed_at).getTime() - last) / DAY_MS, 0)
        const predicted = retrievability(elapsedDays, Math.max(state.stability, 0.01))
        const p = Math.min(Math.max(predicted, EPS), 1 - EPS)
        // Whether memory survived, not how comfortably — the forgetting
        // curve predicts recall/no-recall, so "hard" and "easy" are both a
        // 1 here in the same way they are both "not a lapse" to FSRS itself.
        const recalled = Number(review.rating) > 1 ? 1 : 0

        total += -(recalled * Math.log(p) + (1 - recalled) * Math.log(1 - p))
        count += 1
      }

      state = scheduleReview({
        state,
        rating: Number(review.rating),
        now: review.reviewed_at,
        weights,
      })
    }
  }

  return count > 0 ? total / count : null
}

/** Below this many reviews there is not enough evidence to call it a fit. */
export const MIN_REVIEWS_TO_FIT = 50

/**
 * Fit FSRS weights to one learner's own review log.
 *
 * Coordinate descent with a shrinking step: for each of the 17 parameters
 * in turn, try nudging it up and down by the current step size and keep
 * whichever direction strictly reduces the average log-loss, or leave the
 * parameter alone. When a full pass over all 17 finds no improvement at
 * all, the step halves. The search stops when the step has halved past
 * `minStep` or `maxPasses` is spent, whichever comes first.
 *
 * @param {Array<{artefact_id: string, rating: number, reviewed_at: string}>} reviews
 * @param {object} [options]
 * @param {number[]} [options.initialWeights] where the search starts — the
 *   published defaults unless the caller is re-fitting from an existing fit
 * @param {number} [options.maxPasses] upper bound on full passes over every
 *   parameter, so one call has a predictable worst-case cost
 * @returns {{weights: number[], loss: number|null, startingLoss: number|null,
 *   reviewCount: number, improved: boolean}}
 */
export function fitWeights(reviews, { initialWeights = DEFAULT_WEIGHTS, maxPasses = 25 } = {}) {
  const reviewCount = reviews.length
  const groups = byArtefact(reviews)
  const predictable = groups.reduce((sum, group) => sum + Math.max(group.length - 1, 0), 0)

  const startingWeights = clampToBounds([...initialWeights])

  if (predictable === 0 || reviewCount < MIN_REVIEWS_TO_FIT) {
    return {
      weights: startingWeights,
      loss: null,
      startingLoss: null,
      reviewCount,
      improved: false,
    }
  }

  let weights = startingWeights
  let loss = averageLogLoss(reviews, weights)
  const startingLoss = loss

  let step = 0.5
  const minStep = 0.01

  for (let pass = 0; pass < maxPasses && step >= minStep; pass++) {
    let improvedThisPass = false

    for (let i = 0; i < PARAM_COUNT; i++) {
      const [low, high] = BOUNDS[i]
      const delta = step * Math.max((high - low) * 0.05, 0.02)

      for (const direction of [1, -1]) {
        const candidate = [...weights]
        candidate[i] = Math.min(Math.max(candidate[i] + direction * delta, low), high)

        const candidateLoss = averageLogLoss(reviews, candidate)

        if (candidateLoss != null && candidateLoss < loss - 1e-9) {
          weights = candidate
          loss = candidateLoss
          improvedThisPass = true
        }
      }
    }

    if (!improvedThisPass) step /= 2
  }

  return {
    weights,
    loss,
    startingLoss,
    reviewCount,
    improved: loss < startingLoss - 1e-9,
  }
}
