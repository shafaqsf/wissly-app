import { describe, expect, it } from 'vitest'

import { readingFileName, readingToMarkdown } from './reading-markdown.js'

const glossary = {
  id: 'a1',
  format: 'glossary',
  payload: { term: 'Eigenvector', definition: 'A direction a matrix leaves alone.' },
  section_ordinal: 1,
  anchor: { page: 12 },
}

const summary = {
  id: 'a2',
  format: 'summary',
  payload: {
    three_sentences: ['One.', 'Two.', 'Three.'],
    paragraph: 'A paragraph.',
    full: 'The section at full depth.',
  },
  section_ordinal: 2,
  anchor: { start: 10, end: 40, heading: 'The characteristic polynomial' },
}

describe('exporting reading as Markdown', () => {
  it('titles the file with the course', () => {
    const markdown = readingToMarkdown({ title: 'Optics', artefacts: [glossary] })

    expect(markdown.startsWith('# Optics\n')).toBe(true)
  })

  it('writes a glossary entry as its term and definition', () => {
    const markdown = readingToMarkdown({ title: 'Optics', artefacts: [glossary] })

    expect(markdown).toContain('## Eigenvector')
    expect(markdown).toContain('A direction a matrix leaves alone.')
  })

  it('writes a summary at full depth — an export is not the shallow layer', () => {
    const markdown = readingToMarkdown({ title: 'Optics', artefacts: [summary] })

    expect(markdown).toContain('The section at full depth.')
    expect(markdown).not.toContain('A paragraph.')
  })

  it('keeps every claim pointing at its source', () => {
    const markdown = readingToMarkdown({ title: 'Optics', artefacts: [glossary, summary] })

    expect(markdown).toContain('> Source 1 — page 12')
    expect(markdown).toContain(
      '> Source 2 — The characteristic polynomial, characters 10–40',
    )
  })

  it('says a course has nothing to export rather than handing back a blank file', () => {
    const markdown = readingToMarkdown({ title: 'Optics', artefacts: [] })

    expect(markdown).toContain('No reading yet.')
  })

  it('names the file after the course, in a shape a filesystem accepts', () => {
    expect(readingFileName({ title: 'Analysis I: sequences' })).toBe(
      'analysis-i-sequences-reading.md',
    )
  })
})
