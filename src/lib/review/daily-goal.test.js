import { describe, expect, it } from 'vitest'

import { suggestDailyGoal } from './daily-goal.js'

describe('suggestDailyGoal', () => {
  it('spreads what is due evenly across the days left', () => {
    expect(suggestDailyGoal({ totalDue: 30, daysRemaining: 10 })).toEqual({
      target: 3,
      remaining: 3,
      horizonDays: 10,
    })
  })

  it('rounds a target up rather than down, so the plan never falls short', () => {
    expect(suggestDailyGoal({ totalDue: 10, daysRemaining: 3 })).toEqual({
      target: 4,
      remaining: 4,
      horizonDays: 3,
    })
  })

  it('subtracts what has already been done today', () => {
    expect(
      suggestDailyGoal({ totalDue: 30, daysRemaining: 10, completedToday: 2 }),
    ).toEqual({ target: 3, remaining: 1, horizonDays: 10 })
  })

  it('never asks for fewer than zero more', () => {
    expect(
      suggestDailyGoal({ totalDue: 5, daysRemaining: 5, completedToday: 9 }),
    ).toEqual({ target: 1, remaining: 0, horizonDays: 5 })
  })

  it('treats nothing due as a target of zero', () => {
    expect(suggestDailyGoal({ totalDue: 0, daysRemaining: 7 })).toEqual({
      target: 0,
      remaining: 0,
      horizonDays: 7,
    })
  })

  it('floors the horizon at one day, for an exam that is today', () => {
    expect(suggestDailyGoal({ totalDue: 9, daysRemaining: 0 })).toEqual({
      target: 9,
      remaining: 9,
      horizonDays: 1,
    })
  })
})
