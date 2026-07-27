import { describe, expect, it } from 'vitest'

import { buildStudyPlan } from './plan.js'

describe('buildStudyPlan', () => {
  it('puts a plain suggestion in front of nothing to plan', () => {
    expect(buildStudyPlan({})).toEqual({
      sessions: [{ session: 1, items: [] }],
      totals: { review: 0, gaps: 0, ungenerated: 0 },
    })
  })

  it('leads with clearing what is already due', () => {
    const plan = buildStudyPlan({ dueCount: 5 })

    expect(plan.sessions[0].items[0]).toMatchObject({ kind: 'review', count: 5 })
    expect(plan.sessions[0].items[0].label).toMatch(/5 due reviews/)
  })

  it('names the singular correctly for one due review', () => {
    const plan = buildStudyPlan({ dueCount: 1 })
    expect(plan.sessions[0].items[0].label).toBe('Clear 1 due review')
  })

  it('orders gaps after review and before new material', () => {
    const plan = buildStudyPlan({
      dueCount: 1,
      gaps: [{ id: 'c1', name: 'Martingales', mastery: 0.3, sectionOrdinal: 2 }],
      ungenerated: [{ id: 's9', ordinal: 9, sourceTitle: 'Probability' }],
      sessionSize: 10,
    })

    expect(plan.sessions[0].items.map((item) => item.kind)).toEqual(['review', 'gap', 'new'])
  })

  it('cites the concept and section a gap came from', () => {
    const plan = buildStudyPlan({
      gaps: [{ id: 'c1', name: 'Martingales', mastery: 0.3, sectionOrdinal: 2 }],
    })

    expect(plan.sessions[0].items[0]).toMatchObject({
      kind: 'gap',
      conceptId: 'c1',
      mastery: 0.3,
      sectionOrdinal: 2,
    })
  })

  it('cites the section a piece of new material came from', () => {
    const plan = buildStudyPlan({
      ungenerated: [{ id: 's9', ordinal: 9, sourceId: 'src1', sourceTitle: 'Probability' }],
    })

    expect(plan.sessions[0].items[0]).toMatchObject({
      kind: 'new',
      sectionId: 's9',
      sourceId: 'src1',
    })
    expect(plan.sessions[0].items[0].label).toContain('Probability')
  })

  it('chunks items across sessions at the given size', () => {
    const gaps = Array.from({ length: 7 }, (_, index) => ({
      id: `c${index}`,
      name: `Concept ${index}`,
      mastery: 0.2,
    }))

    const plan = buildStudyPlan({ gaps, sessionSize: 3 })

    expect(plan.sessions).toHaveLength(3)
    expect(plan.sessions[0].items).toHaveLength(3)
    expect(plan.sessions[2].items).toHaveLength(1)
  })

  it('bounds the session size to a sane range', () => {
    const gaps = Array.from({ length: 3 }, (_, index) => ({ id: `c${index}`, name: 'x', mastery: 0.1 }))

    const huge = buildStudyPlan({ gaps, sessionSize: 999 })
    expect(huge.sessions[0].items).toHaveLength(3)

    const zero = buildStudyPlan({ gaps, sessionSize: 0 })
    expect(zero.sessions[0].items.length).toBeGreaterThan(0)
  })

  it('totals what it planned, independent of how it was chunked', () => {
    const plan = buildStudyPlan({
      dueCount: 4,
      gaps: [{ id: 'c1', name: 'x', mastery: 0.1 }],
      ungenerated: [{ id: 's1', ordinal: 1 }, { id: 's2', ordinal: 2 }],
      sessionSize: 1,
    })

    expect(plan.totals).toEqual({ review: 4, gaps: 1, ungenerated: 2 })
  })
})
