// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { predictExamPass } from './exam-pass.js'

function concept(mastery, overrides = {}) {
  return { id: `c-${mastery}`, name: `Concept ${mastery}`, mastery, ...overrides }
}

describe('predicting exam pass', () => {
  it('has nothing to predict from an empty course', () => {
    const result = predictExamPass({ concepts: [] })

    expect(result.probability).toBeNull()
    expect(result.drivers).toEqual([])
  })

  it('is confident, but never certain, when every concept is settled and nothing is overdue', () => {
    const result = predictExamPass({
      concepts: [concept(0.95), concept(0.98), concept(1)],
      overdueFraction: 0,
    })

    expect(result.probability).toBeGreaterThan(0.85)
    expect(result.probability).toBeLessThan(0.98)
  })

  it('is doubtful, but never zero, when nothing has been learned', () => {
    const result = predictExamPass({
      concepts: [concept(0), concept(0), concept(0)],
      overdueFraction: 0,
    })

    expect(result.probability).toBeLessThan(0.15)
    expect(result.probability).toBeGreaterThan(0.02)
  })

  it('rises monotonically with average mastery, holding everything else fixed', () => {
    const weak = predictExamPass({ concepts: [concept(0.3), concept(0.4)], overdueFraction: 0.2 })
    const strong = predictExamPass({ concepts: [concept(0.7), concept(0.8)], overdueFraction: 0.2 })

    expect(strong.probability).toBeGreaterThan(weak.probability)
  })

  it('is pulled down by a queue that has fallen behind, even at the same mastery', () => {
    const concepts = [concept(0.6), concept(0.65)]

    const current = predictExamPass({ concepts, overdueFraction: 0 })
    const behind = predictExamPass({ concepts, overdueFraction: 0.8 })

    expect(behind.probability).toBeLessThan(current.probability)
  })

  it('credits a learner with time and momentum left before the exam, never past what is left to learn', () => {
    const concepts = [concept(0.4), concept(0.5)]

    const noTime = predictExamPass({ concepts, overdueFraction: 0, daysUntilExam: null, reviewsPerDay: 5 })
    const withTime = predictExamPass({ concepts, overdueFraction: 0, daysUntilExam: 30, reviewsPerDay: 5 })

    expect(withTime.probability).toBeGreaterThanOrEqual(noTime.probability)
    expect(withTime.projectedMastery).toBeLessThanOrEqual(1)
  })

  it('names the weakest concepts under the readiness bar, ranked, capped at the limit', () => {
    const concepts = [concept(0.1, { name: 'Weakest' }), concept(0.9), concept(0.2, { name: 'Second weakest' }), concept(0.05, { name: 'Very weak' })]

    const result = predictExamPass({ concepts, weakLimit: 2 })

    expect(result.drivers).toHaveLength(2)
    expect(result.drivers[0].name).toBe('Very weak')
    expect(result.drivers[1].name).toBe('Weakest')
  })

  it('never claims certainty in either direction', () => {
    const settled = predictExamPass({ concepts: [concept(1), concept(1)], overdueFraction: 0, daysUntilExam: 90, reviewsPerDay: 20 })
    const untouched = predictExamPass({ concepts: [concept(0), concept(0)], overdueFraction: 1 })

    expect(settled.probability).toBeLessThan(1)
    expect(untouched.probability).toBeGreaterThan(0)
  })
})
