// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  DECAY,
  FACTOR,
  initialState,
  intervalFromStability,
  retrievability,
  scheduleReview,
} from './fsrs.js'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-07-24T09:00:00.000Z')

describe('retrievability', () => {
  it('is 1 the moment a card is reviewed', () => {
    expect(retrievability(0, 5)).toBeCloseTo(1, 10)
  })

  it('is the requested retention once stability days have passed', () => {
    // The FSRS forgetting curve is defined so that R(S, S) = 0.9.
    expect(retrievability(5, 5)).toBeCloseTo(0.9, 6)
    expect(retrievability(37, 37)).toBeCloseTo(0.9, 6)
  })

  it('decays monotonically with elapsed time', () => {
    const a = retrievability(1, 10)
    const b = retrievability(5, 10)
    const c = retrievability(50, 10)
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
    expect(c).toBeGreaterThan(0)
  })

  it('uses the published power curve', () => {
    expect(retrievability(3, 7)).toBeCloseTo((1 + (FACTOR * 3) / 7) ** DECAY, 12)
  })
})

describe('intervalFromStability', () => {
  it('inverts the forgetting curve at 0.9 retention', () => {
    expect(intervalFromStability(12, 0.9)).toBe(12)
  })

  it('asks for a shorter interval when more retention is demanded', () => {
    expect(intervalFromStability(20, 0.95)).toBeLessThan(
      intervalFromStability(20, 0.9),
    )
  })

  it('never schedules a card less than a day out', () => {
    expect(intervalFromStability(0.01, 0.9)).toBe(1)
  })

  it('rounds to whole days', () => {
    expect(Number.isInteger(intervalFromStability(37.4, 0.9))).toBe(true)
  })
})

describe('initialState', () => {
  it('is null, so a first review has no previous state', () => {
    expect(initialState()).toBe(null)
  })
})

describe('scheduleReview — the first review of a card', () => {
  it('seeds stability from the rating', () => {
    const again = scheduleReview({ state: null, rating: 1, now })
    const easy = scheduleReview({ state: null, rating: 4, now })
    expect(again.stability).toBeLessThan(easy.stability)
    expect(again.stability).toBeGreaterThan(0)
  })

  it('seeds difficulty from the rating, hardest for `again`', () => {
    const again = scheduleReview({ state: null, rating: 1, now })
    const good = scheduleReview({ state: null, rating: 3, now })
    const easy = scheduleReview({ state: null, rating: 4, now })
    expect(again.difficulty).toBeGreaterThan(good.difficulty)
    expect(good.difficulty).toBeGreaterThan(easy.difficulty)
  })

  it('keeps difficulty inside the 1..10 band whatever the rating', () => {
    for (const rating of [1, 2, 3, 4]) {
      const next = scheduleReview({ state: null, rating, now })
      expect(next.difficulty).toBeGreaterThanOrEqual(1)
      expect(next.difficulty).toBeLessThanOrEqual(10)
    }
  })

  it('counts the review and records no lapse unless the answer was forgotten', () => {
    expect(scheduleReview({ state: null, rating: 3, now }).reps).toBe(1)
    expect(scheduleReview({ state: null, rating: 3, now }).lapses).toBe(0)
    expect(scheduleReview({ state: null, rating: 1, now }).lapses).toBe(1)
  })

  it('returns a due date an interval ahead of the review', () => {
    const next = scheduleReview({ state: null, rating: 3, now })
    expect(next.due_at).toBe(
      new Date(now.getTime() + next.interval * DAY).toISOString(),
    )
    expect(next.last_reviewed_at).toBe(now.toISOString())
  })
})

describe('scheduleReview — a card with history', () => {
  const state = {
    stability: 10,
    difficulty: 5,
    reps: 3,
    lapses: 0,
    due_at: new Date(now.getTime() - 2 * DAY).toISOString(),
    last_reviewed_at: new Date(now.getTime() - 12 * DAY).toISOString(),
  }

  it('grows stability on a successful recall', () => {
    const next = scheduleReview({ state, rating: 3, now })
    expect(next.stability).toBeGreaterThan(state.stability)
  })

  it('rewards `easy` more than `good`, and `good` more than `hard`', () => {
    const hard = scheduleReview({ state, rating: 2, now }).stability
    const good = scheduleReview({ state, rating: 3, now }).stability
    const easy = scheduleReview({ state, rating: 4, now }).stability
    expect(hard).toBeLessThan(good)
    expect(good).toBeLessThan(easy)
  })

  it('collapses stability and records a lapse when the answer is forgotten', () => {
    const next = scheduleReview({ state, rating: 1, now })
    expect(next.stability).toBeLessThan(state.stability)
    expect(next.lapses).toBe(1)
    expect(next.reps).toBe(4)
  })

  it('makes a card harder on `again` and easier on `easy`', () => {
    expect(scheduleReview({ state, rating: 1, now }).difficulty).toBeGreaterThan(
      state.difficulty,
    )
    expect(scheduleReview({ state, rating: 4, now }).difficulty).toBeLessThan(
      state.difficulty,
    )
  })

  it('leaves difficulty all but unchanged on `good`', () => {
    const next = scheduleReview({ state, rating: 3, now })
    expect(Math.abs(next.difficulty - state.difficulty)).toBeLessThan(0.5)
  })

  it('grows stability less the harder the card is', () => {
    const easyCard = scheduleReview({
      state: { ...state, difficulty: 2 },
      rating: 3,
      now,
    })
    const hardCard = scheduleReview({
      state: { ...state, difficulty: 9 },
      rating: 3,
      now,
    })
    expect(hardCard.stability).toBeLessThan(easyCard.stability)
  })

  it('grows stability more the longer the card was left alone', () => {
    const soon = scheduleReview({
      state: { ...state, last_reviewed_at: new Date(now.getTime() - DAY).toISOString() },
      rating: 3,
      now,
    })
    const late = scheduleReview({
      state: { ...state, last_reviewed_at: new Date(now.getTime() - 30 * DAY).toISOString() },
      rating: 3,
      now,
    })
    expect(late.stability).toBeGreaterThan(soon.stability)
  })

  it('never lets stability fall below the floor', () => {
    let next = { ...state, stability: 0.02 }
    for (let i = 0; i < 20; i += 1) {
      next = scheduleReview({ state: next, rating: 1, now })
    }
    expect(next.stability).toBeGreaterThanOrEqual(0.01)
  })

  it('keeps difficulty inside 1..10 under a long run of one rating', () => {
    for (const rating of [1, 4]) {
      let next = state
      for (let i = 0; i < 50; i += 1) {
        next = scheduleReview({ state: next, rating, now })
      }
      expect(next.difficulty).toBeGreaterThanOrEqual(1)
      expect(next.difficulty).toBeLessThanOrEqual(10)
    }
  })

  it('honours a requested retention above the 0.9 default', () => {
    const strict = scheduleReview({ state, rating: 3, now, requestRetention: 0.97 })
    const normal = scheduleReview({ state, rating: 3, now })
    expect(strict.interval).toBeLessThan(normal.interval)
    expect(strict.stability).toBeCloseTo(normal.stability, 10)
  })

  it('is pure — it does not mutate the state handed to it', () => {
    const before = JSON.stringify(state)
    scheduleReview({ state, rating: 1, now })
    expect(JSON.stringify(state)).toBe(before)
  })

  it('is deterministic', () => {
    const a = scheduleReview({ state, rating: 2, now })
    const b = scheduleReview({ state, rating: 2, now })
    expect(a).toEqual(b)
  })

  it('accepts an ISO string for `now` as well as a Date', () => {
    const a = scheduleReview({ state, rating: 3, now })
    const b = scheduleReview({ state, rating: 3, now: now.toISOString() })
    expect(a).toEqual(b)
  })

  it('defaults `now` to the current clock', () => {
    const next = scheduleReview({ state, rating: 3 })
    expect(Date.parse(next.last_reviewed_at)).toBeGreaterThan(Date.now() - 5000)
  })
})

describe('scheduleReview — rejected input', () => {
  it('refuses a rating outside 1..4', () => {
    for (const rating of [0, 5, 2.5, '3', null, undefined, NaN]) {
      expect(() => scheduleReview({ state: null, rating, now })).toThrow(
        /rating must be an integer 1..4/,
      )
    }
  })

  it('refuses a retention outside the open interval (0, 1)', () => {
    for (const requestRetention of [0, 1, -0.5, 1.5]) {
      expect(() =>
        scheduleReview({ state: null, rating: 3, now, requestRetention }),
      ).toThrow(/requestRetention/)
    }
  })
})
