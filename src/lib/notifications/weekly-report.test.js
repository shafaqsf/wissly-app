import { describe, expect, it } from 'vitest'

import { buildWeeklyReport, emailFromReport } from './weekly-report.js'

const PERIOD = { periodStart: '2026-07-19T00:00:00.000Z', periodEnd: '2026-07-26T00:00:00.000Z' }

describe('building a weekly report', () => {
  it('carries the period and the raw counts a caller gave it', () => {
    const report = buildWeeklyReport({
      ...PERIOD,
      reviewsDone: 42,
      ratingCounts: { 1: 3, 2: 5, 3: 20, 4: 14 },
      masteryNow: 0.62,
      masteryBefore: null,
      streakDays: 5,
      dueNext7Days: 18,
    })

    expect(report.period).toEqual({ start: PERIOD.periodStart, end: PERIOD.periodEnd })
    expect(report.stats.reviewsDone).toBe(42)
    expect(report.stats.streakDays).toBe(5)
    expect(report.stats.dueNext7Days).toBe(18)
    expect(report.stats.masteryNow).toBe(0.62)
  })

  it('computes accuracy from good and easy ratings, against every graded review', () => {
    const report = buildWeeklyReport({
      ...PERIOD,
      reviewsDone: 10,
      ratingCounts: { 1: 2, 2: 1, 3: 4, 4: 3 },
      masteryNow: 0.5,
      streakDays: 1,
      dueNext7Days: 0,
    })

    // (4 good + 3 easy) / 10
    expect(report.stats.accuracy).toBeCloseTo(0.7)
  })

  it('leaves accuracy null rather than dividing by zero when nothing was reviewed', () => {
    const report = buildWeeklyReport({
      ...PERIOD,
      reviewsDone: 0,
      ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
      masteryNow: 0.5,
      streakDays: 0,
      dueNext7Days: 3,
    })

    expect(report.stats.accuracy).toBeNull()
  })

  it('reports a mastery delta when it has a snapshot to diff against', () => {
    const report = buildWeeklyReport({
      ...PERIOD,
      reviewsDone: 10,
      ratingCounts: { 1: 0, 2: 0, 3: 5, 4: 5 },
      masteryNow: 0.65,
      masteryBefore: 0.58,
      streakDays: 3,
      dueNext7Days: 4,
    })

    expect(report.stats.masteryDelta).toBeCloseTo(0.07)
  })

  it('leaves the delta null, with a TODO explaining why, when there is no prior snapshot', () => {
    const report = buildWeeklyReport({
      ...PERIOD,
      reviewsDone: 10,
      ratingCounts: { 1: 0, 2: 0, 3: 5, 4: 5 },
      masteryNow: 0.65,
      masteryBefore: null,
      streakDays: 3,
      dueNext7Days: 4,
    })

    expect(report.stats.masteryDelta).toBeNull()
    expect(report.todos.join(' ')).toMatch(/mastery.*history|history.*mastery/i)
  })

  it('names what the week actually held in its headline, not a generic greeting', () => {
    const busy = buildWeeklyReport({
      ...PERIOD,
      reviewsDone: 42,
      ratingCounts: { 1: 3, 2: 5, 3: 20, 4: 14 },
      masteryNow: 0.62,
      streakDays: 5,
      dueNext7Days: 18,
    })
    const quiet = buildWeeklyReport({
      ...PERIOD,
      reviewsDone: 0,
      ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
      masteryNow: 0,
      streakDays: 0,
      dueNext7Days: 0,
    })

    expect(busy.headline).toMatch(/42/)
    expect(quiet.headline).not.toMatch(/42/)
    expect(quiet.headline).not.toMatch(/sorry/i)
  })
})

describe('turning a report into an email', () => {
  it('addresses the learner as "you" and states facts, not apologies', () => {
    const report = buildWeeklyReport({
      ...PERIOD,
      reviewsDone: 12,
      ratingCounts: { 1: 1, 2: 1, 3: 6, 4: 4 },
      masteryNow: 0.5,
      streakDays: 2,
      dueNext7Days: 5,
    })

    const email = emailFromReport(report, { to: 'learner@example.com' })

    expect(email.to).toBe('learner@example.com')
    expect(email.subject).toMatch(/12/)
    expect(email.text).toMatch(/\byou\b/i)
    expect(email.text).not.toMatch(/sorry|we apologize/i)
  })

  it('mentions what upcoming data would sharpen the numbers, as a TODO the reader never sees rendered as a bug', () => {
    const report = buildWeeklyReport({
      ...PERIOD,
      reviewsDone: 12,
      ratingCounts: { 1: 1, 2: 1, 3: 6, 4: 4 },
      masteryNow: 0.5,
      masteryBefore: null,
      streakDays: 2,
      dueNext7Days: 5,
    })

    const email = emailFromReport(report, { to: 'learner@example.com' })

    // The TODOs are for the maintainer reading the object, not prose mailed
    // to a learner.
    expect(email.text).not.toMatch(/TODO/)
  })
})
