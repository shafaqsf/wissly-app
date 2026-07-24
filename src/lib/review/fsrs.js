/**
 * FSRS — the Free Spaced Repetition Scheduler, as a pure function.
 *
 * One call takes the previous state of a card and a rating in 1..4 and returns
 * the next state. Nothing here reads a clock it was not given, touches the
 * network, or mutates its argument, so the whole schedule is reproducible from
 * a review log.
 *
 * The model has two variables per card:
 *
 * - **stability** (`S`), in days: how long the memory survives before recall
 *   probability falls to the requested retention.
 * - **difficulty** (`D`), in 1..10: how badly this particular card resists
 *   gaining stability.
 *
 * Ratings follow the FSRS convention:
 * `1 = again`, `2 = hard`, `3 = good`, `4 = easy`.
 *
 * The weights are the published FSRS-4.5 defaults, fitted over a very large
 * review corpus. They are a starting point, not a constant of nature — once
 * wissly has its own review log they can be re-fitted per learner and passed
 * in as `weights`.
 */

/** Published FSRS-4.5 default weights. */
export const DEFAULT_WEIGHTS = Object.freeze([
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
])

/** Exponent of the power forgetting curve. */
export const DECAY = -0.5

/**
 * Scaling constant of the forgetting curve, chosen so that `R(S, S) = 0.9`:
 * a card is at 90 % recall probability exactly one stability after review.
 */
export const FACTOR = 19 / 81

const MIN_DIFFICULTY = 1
const MAX_DIFFICULTY = 10
const MIN_STABILITY = 0.01
const MIN_INTERVAL = 1
const MAX_INTERVAL = 36500
const DAY_MS = 24 * 60 * 60 * 1000

const clamp = (value, low, high) => Math.min(Math.max(value, low), high)

/**
 * Probability that a card is still recalled `elapsedDays` after its last
 * review, given its stability.
 *
 * @param {number} elapsedDays
 * @param {number} stability
 * @returns {number} between 0 and 1
 */
export function retrievability(elapsedDays, stability) {
  return (1 + (FACTOR * Math.max(elapsedDays, 0)) / stability) ** DECAY
}

/**
 * The inverse: how many whole days until recall probability decays to
 * `requestRetention`.
 *
 * @param {number} stability
 * @param {number} requestRetention
 * @returns {number} whole days, at least 1
 */
export function intervalFromStability(stability, requestRetention) {
  const days = (stability / FACTOR) * (requestRetention ** (1 / DECAY) - 1)
  return clamp(Math.round(days), MIN_INTERVAL, MAX_INTERVAL)
}

/** A card that has never been reviewed has no state. */
export function initialState() {
  return null
}

function assertRating(rating) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 4) {
    throw new TypeError(
      `rating must be an integer 1..4 (1 again, 2 hard, 3 good, 4 easy), got ${String(rating)}`,
    )
  }
}

function assertRetention(requestRetention) {
  if (
    typeof requestRetention !== 'number' ||
    Number.isNaN(requestRetention) ||
    requestRetention <= 0 ||
    requestRetention >= 1
  ) {
    throw new RangeError(
      `requestRetention must be a number strictly between 0 and 1, got ${String(requestRetention)}`,
    )
  }
}

function toDate(value) {
  if (value === undefined || value === null) return new Date()
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`invalid date: ${String(value)}`)
  }
  return date
}

/** Stability of a card seen for the first time, taken straight from w0..w3. */
function initialStability(w, rating) {
  return Math.max(w[rating - 1], MIN_STABILITY)
}

/** Difficulty of a card seen for the first time. */
function initialDifficulty(w, rating) {
  return clamp(w[4] - (rating - 3) * w[5], MIN_DIFFICULTY, MAX_DIFFICULTY)
}

/**
 * Difficulty after a review: a linear step by rating, then mean reversion
 * towards the difficulty an `easy` first review would have produced. Without
 * the reversion difficulty ratchets in one direction and never comes back.
 */
function nextDifficulty(w, difficulty, rating) {
  const stepped = difficulty - w[6] * (rating - 3)
  const reverted = w[7] * initialDifficulty(w, 4) + (1 - w[7]) * stepped
  return clamp(reverted, MIN_DIFFICULTY, MAX_DIFFICULTY)
}

/**
 * Stability after a successful recall. It grows most when the card is easy,
 * when stability is already low, and when recall succeeded despite a low
 * retrievability — remembering something you were about to forget is what
 * actually moves the needle.
 */
function stabilityAfterRecall(w, difficulty, stability, r, rating) {
  const hardPenalty = rating === 2 ? w[15] : 1
  const easyBonus = rating === 4 ? w[16] : 1
  const growth =
    Math.exp(w[8]) *
    (11 - difficulty) *
    stability ** -w[9] *
    (Math.exp(w[10] * (1 - r)) - 1) *
    hardPenalty *
    easyBonus
  return Math.max(stability * (1 + growth), MIN_STABILITY)
}

/** Stability after a lapse. Never allowed to exceed the stability it replaces. */
function stabilityAfterLapse(w, difficulty, stability, r) {
  const lapsed =
    w[11] *
    difficulty ** -w[12] *
    ((stability + 1) ** w[13] - 1) *
    Math.exp(w[14] * (1 - r))
  return clamp(lapsed, MIN_STABILITY, stability)
}

/**
 * Schedule the next review of a card.
 *
 * @param {object} options
 * @param {object|null} options.state previous state, or `null` for a new card
 * @param {number} options.state.stability
 * @param {number} options.state.difficulty
 * @param {number} options.state.reps
 * @param {number} options.state.lapses
 * @param {string} options.state.due_at ISO timestamp
 * @param {string} [options.state.last_reviewed_at] ISO timestamp
 * @param {number} options.rating 1 again, 2 hard, 3 good, 4 easy
 * @param {Date|string} [options.now] when the review happened
 * @param {number} [options.requestRetention=0.9] target recall probability
 * @param {number[]} [options.weights] FSRS weights, 17 of them
 * @returns {{stability: number, difficulty: number, reps: number, lapses: number,
 *   interval: number, due_at: string, last_reviewed_at: string,
 *   retrievability: number, elapsed_days: number}}
 */
export function scheduleReview({
  state = null,
  rating,
  now,
  requestRetention = 0.9,
  weights = DEFAULT_WEIGHTS,
} = {}) {
  assertRating(rating)
  assertRetention(requestRetention)

  const w = weights
  const reviewedAt = toDate(now)

  let stability
  let difficulty
  let elapsedDays = 0
  let r = 0

  if (!state) {
    stability = initialStability(w, rating)
    difficulty = initialDifficulty(w, rating)
  } else {
    const last = toDate(state.last_reviewed_at ?? state.due_at)
    elapsedDays = Math.max((reviewedAt.getTime() - last.getTime()) / DAY_MS, 0)
    const previousStability = Math.max(state.stability, MIN_STABILITY)
    const previousDifficulty = clamp(
      state.difficulty,
      MIN_DIFFICULTY,
      MAX_DIFFICULTY,
    )
    r = retrievability(elapsedDays, previousStability)
    difficulty = nextDifficulty(w, previousDifficulty, rating)
    stability =
      rating === 1
        ? stabilityAfterLapse(w, previousDifficulty, previousStability, r)
        : stabilityAfterRecall(
            w,
            previousDifficulty,
            previousStability,
            r,
            rating,
          )
  }

  const interval = intervalFromStability(stability, requestRetention)

  return {
    stability,
    difficulty,
    reps: (state?.reps ?? 0) + 1,
    lapses: (state?.lapses ?? 0) + (rating === 1 ? 1 : 0),
    interval,
    due_at: new Date(reviewedAt.getTime() + interval * DAY_MS).toISOString(),
    last_reviewed_at: reviewedAt.toISOString(),
    retrievability: r,
    elapsed_days: elapsedDays,
  }
}
