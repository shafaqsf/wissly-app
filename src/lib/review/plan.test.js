import { describe, expect, it } from 'vitest'

import { compressedPlan } from './plan.js'

const NOW = '2026-07-26T09:00:00.000Z'

describe('compressedPlan', () => {
  it('returns one entry per day from today to the exam, inclusive', () => {
    const plan = compressedPlan({ schedule: [], examDate: '2026-07-29', now: NOW })

    expect(plan.map((day) => day.date)).toEqual([
      '2026-07-26',
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
    ])
  })

  it('gives every day zero when nothing is scheduled', () => {
    const plan = compressedPlan({ schedule: [], examDate: '2026-07-28', now: NOW })

    expect(plan.every((day) => day.count === 0)).toBe(true)
  })

  it('keeps an artefact on its own due day when there is room for it', () => {
    const schedule = [
      { artefactId: 'a1', stability: 5, dueAt: '2026-07-27T00:00:00.000Z' },
    ]

    const plan = compressedPlan({ schedule, examDate: '2026-07-29', now: NOW })

    expect(plan.find((day) => day.date === '2026-07-27').artefactIds).toEqual(['a1'])
  })

  it('pulls a day due after the exam back onto the last day of the plan', () => {
    const schedule = [
      { artefactId: 'a1', stability: 5, dueAt: '2026-08-15T00:00:00.000Z' },
    ]

    const plan = compressedPlan({ schedule, examDate: '2026-07-28', now: NOW })

    expect(plan[plan.length - 1].artefactIds).toContain('a1')
  })

  it('treats a never-reviewed artefact as maximally urgent', () => {
    // Capacity of 1/day forces a choice between the two; the never-reviewed
    // one (no stability) must win it and land on the earlier day.
    const schedule = [
      { artefactId: 'seen', stability: 30, dueAt: '2026-07-26T00:00:00.000Z' },
      { artefactId: 'new', dueAt: '2026-07-26T00:00:00.000Z' },
    ]

    const plan = compressedPlan({ schedule, examDate: '2026-07-27', now: NOW })

    expect(plan[0].artefactIds).toEqual(['new']);
  })

  it('spreads an overloaded day across the days that follow rather than dropping anything', () => {
    const schedule = Array.from({ length: 6 }, (_, index) => ({
      artefactId: `a${index}`,
      stability: 3,
      dueAt: NOW,
    }))

    const plan = compressedPlan({ schedule, examDate: '2026-07-28', now: NOW })

    const total = plan.reduce((sum, day) => sum + day.count, 0)
    expect(total).toBe(6)
    // Three days, six items: nothing should have to double up more than
    // capacity (ceil(6/3) = 2) allows.
    expect(plan.every((day) => day.count <= 2)).toBe(true)
  })

  it('crams everything into one day when the exam is today or already past', () => {
    const schedule = [
      { artefactId: 'a1', stability: 5, dueAt: '2026-07-30T00:00:00.000Z' },
      { artefactId: 'a2', dueAt: '2026-07-20T00:00:00.000Z' },
    ]

    const plan = compressedPlan({ schedule, examDate: '2026-07-20', now: NOW })

    expect(plan).toHaveLength(1)
    expect(plan[0].count).toBe(2)
  })
})
