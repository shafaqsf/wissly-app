import { describe, expect, it } from 'vitest'

import { exportFilename, flashcardsAsAnki, flashcardsAsCsv } from './export'

const cards = [
  { payload: { front: 'What is an eigenvalue?', back: 'A scale factor.' } },
  { payload: { front: 'Define "rank", briefly', back: 'The dimension of the image.' } },
]

describe('flashcards as CSV', () => {
  it('writes a header and one row per card', () => {
    expect(flashcardsAsCsv([cards[0]])).toBe(
      'Front,Back\nWhat is an eigenvalue?,A scale factor.',
    )
  })

  it('quotes a cell that holds a comma or a quote', () => {
    expect(flashcardsAsCsv([cards[1]])).toBe(
      'Front,Back\n"Define ""rank"", briefly",The dimension of the image.',
    )
  })

  it('is a header and nothing else when there is nothing to export', () => {
    expect(flashcardsAsCsv([])).toBe('Front,Back')
  })
})

describe('flashcards as an Anki deck', () => {
  it('carries the settings Anki reads before the first card', () => {
    expect(flashcardsAsAnki(cards).split('\n').slice(0, 2)).toEqual([
      '#separator:tab',
      '#html:false',
    ])
  })

  it('separates the two sides with a tab', () => {
    expect(flashcardsAsAnki([cards[0]]).split('\n')[2]).toBe(
      'What is an eigenvalue?\tA scale factor.',
    )
  })

  it('flattens a card that spans lines, because Anki reads one card per line', () => {
    const written = flashcardsAsAnki([
      { payload: { front: 'One\nTwo', back: 'Three\r\nFour' } },
    ])

    expect(written.split('\n')[2]).toBe('One Two\tThree Four')
  })
})

describe('the file it lands in', () => {
  it('is named after the course', () => {
    expect(exportFilename({ course: 'Analysis I', extension: 'csv' })).toBe('analysis-i.csv')
  })

  it('falls back to the type when no course is chosen', () => {
    expect(exportFilename({ course: '', extension: 'txt' })).toBe('flashcards.txt')
  })
})
