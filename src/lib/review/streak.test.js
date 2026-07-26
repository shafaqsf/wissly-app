import { describe, expect, it } from 'vitest'

import { STREAK_MILESTONES, currentStreak, streakMilestone } from './streak.js'

const NOW = '2026-07-26T18:00:00.000Z'

describe('currentStreak', () => {
  it('is zero with no review history', () => {
    expect(currentStreak([], NOW)).toBe(0)
  })

  it('is one when the only review was today', () => {
    expect(currentStreak(['2026-07-26T09:00:00.000Z'], NOW)).toBe(1)
  })

  it('counts consecutive days including today', () => {
    const reviewedAt = [
      '2026-07-26T09:00:00.000Z',
      '2026-07-25T09:00:00.000Z',
      '2026-07-24T09:00:00.000Z',
    ]

    expect(currentStreak(reviewedAt, NOW)).toBe(3)
  })

  it('stays alive when nothing has been reviewed yet today but yesterday was covered', () => {
    const reviewedAt = ['2026-07-25T09:00:00.000Z', '2026-07-24T09:00:00.000Z']

    expect(currentStreak(reviewedAt, NOW)).toBe(2)
  })

  it('breaks when a day was skipped', () => {
    // Two days ago, nothing yesterday, nothing today.
    const reviewedAt = ['2026-07-24T09:00:00.000Z']

    expect(currentStreak(reviewedAt, NOW)).toBe(0)
  })

  it('counts a day once no matter how many reviews landed in it', () => {
    const reviewedAt = [
      '2026-07-26T08:00:00.000Z',
      '2026-07-26T09:00:00.000Z',
      '2026-07-26T20:00:00.000Z',
    ]

    expect(currentStreak(reviewedAt, NOW)).toBe(1)
  })

  it('is unaffected by review order', () => {
    const reviewedAt = [
      '2026-07-24T09:00:00.000Z',
      '2026-07-26T09:00:00.000Z',
      '2026-07-25T09:00:00.000Z',
    ]

    expect(currentStreak(reviewedAt, NOW)).toBe(3)
  })
})

describe('streakMilestone', () => {
  it('is null below the first milestone', () => {
    expect(streakMilestone(6)).toBeNull()
  })

  it.each(STREAK_MILESTONES)('names the milestone at exactly %i days', (milestone) => {
    expect(streakMilestone(milestone)).toBe(milestone)
  })

  it('names the highest milestone reached rather than the nearest', () => {
    expect(streakMilestone(150)).toBe(100)
    expect(streakMilestone(45)).toBe(30)
  })
})
