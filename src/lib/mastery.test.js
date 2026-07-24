import { describe, expect, it } from 'vitest'
import { averageMastery, masteryState } from './mastery'

describe('masteryState', () => {
  it('reads an untouched concept as fully unresolved', () => {
    expect(masteryState(0)).toMatchObject({
      id: 'untouched',
      label: 'Untouched',
      grain: 'var(--grain-3)',
    })
  })

  it('reads anything under way as partially resolved', () => {
    expect(masteryState(0.01).grain).toBe('var(--grain-2)')
    expect(masteryState(0.5)).toMatchObject({
      id: 'in-progress',
      label: 'In progress',
      grain: 'var(--grain-2)',
    })
    expect(masteryState(0.89).grain).toBe('var(--grain-2)')
  })

  it('reads a mastered concept as clean paper', () => {
    expect(masteryState(0.9)).toMatchObject({
      id: 'mastered',
      label: 'Mastered',
      grain: 'var(--grain-0)',
    })
    expect(masteryState(1).grain).toBe('var(--grain-0)')
  })

  it('treats a missing or out of range value as untouched', () => {
    expect(masteryState(undefined).id).toBe('untouched')
    expect(masteryState(-1).id).toBe('untouched')
    expect(masteryState(4).id).toBe('mastered')
  })
})

describe('averageMastery', () => {
  it('averages the concepts it is given', () => {
    expect(averageMastery([{ mastery: 0 }, { mastery: 1 }])).toBe(0.5)
  })

  it('calls an empty subject untouched rather than dividing by zero', () => {
    expect(averageMastery([])).toBe(0)
  })
})
