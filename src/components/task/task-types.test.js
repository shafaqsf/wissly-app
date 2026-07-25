import { describe, expect, it } from 'vitest'

import { TASK_FORMATS } from '@/lib/agent/formats'
import { FORMAT_NAMES, TASK_TYPES, typeByFormat, typeBySlug } from './task-types'

describe('the task types', () => {
  it('covers every task format, and nothing that is read rather than answered', () => {
    expect(TASK_TYPES.map((type) => type.format)).toEqual([...TASK_FORMATS])
  })

  it('never says "artefact" to the learner', () => {
    for (const type of TASK_TYPES) {
      expect(type.label.toLowerCase()).not.toContain('artefact')
      expect(type.one.toLowerCase()).not.toContain('artefact')
    }
  })

  it('gives each type an address a learner could read out', () => {
    expect(TASK_TYPES.map((type) => type.slug)).toEqual([
      'flashcards',
      'cloze',
      'multiple-choice',
      'open-questions',
    ])
  })

  it('finds a type by its slug and by its format', () => {
    expect(typeBySlug('open-questions').format).toBe('open_question')
    expect(typeByFormat('multiple_choice').slug).toBe('multiple-choice')
  })

  it('answers nothing for a slug that is not a type', () => {
    expect(typeBySlug('summaries')).toBeUndefined()
    expect(typeByFormat('summary')).toBeUndefined()
  })

  it('names one of each, for the label on a single card', () => {
    expect(FORMAT_NAMES).toEqual({
      flashcard: 'Flashcard',
      cloze: 'Cloze',
      multiple_choice: 'Multiple choice',
      open_question: 'Open question',
    })
  })
})
