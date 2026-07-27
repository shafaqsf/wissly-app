import { describe, expect, it } from 'vitest'

import { bundleToMarkdown } from './markdown.js'

const bundle = {
  exported_at: '2026-07-26T00:00:00.000Z',
  courses: [
    {
      subject: { id: 's1', title: 'Optics' },
      sources: [
        {
          id: 'src1',
          title: 'Chapter 1',
          kind: 'text',
          sections: [{ id: 'sec1', ordinal: 1, content: 'Light bends.', anchor: { page: 4 } }],
        },
      ],
      concepts: [{ id: 'c1', term: 'Refraction', definition: 'The bending of light.' }],
      artefacts: [
        {
          id: 'a1',
          format: 'flashcard',
          payload: { front: 'What bends light?', back: 'A change of medium.' },
          section_ordinal: 1,
          anchor: { page: 4 },
        },
        {
          id: 'a2',
          format: 'cloze',
          payload: { text: 'Light ____ at a boundary.', answer: 'bends' },
          section_ordinal: 1,
          anchor: { page: 4 },
        },
        {
          id: 'a3',
          format: 'multiple_choice',
          payload: {
            stem: 'What bends light?',
            options: ['A prism', 'A mirror'],
            answer_index: 0,
            rationales: ['Correct — it refracts.', 'Wrong — that reflects.'],
          },
          section_ordinal: 1,
          anchor: { page: 4 },
        },
        {
          id: 'a4',
          format: 'open_question',
          payload: {
            prompt: 'Explain refraction.',
            model_answer: 'Light changes speed and bends.',
            criteria: ['Mentions speed change'],
          },
          section_ordinal: 1,
          anchor: { page: 4 },
        },
        {
          id: 'a5',
          format: 'glossary',
          payload: { term: 'Refraction', definition: 'The bending of light.' },
          section_ordinal: null,
          anchor: null,
        },
        {
          id: 'a6',
          format: 'summary',
          payload: { three_sentences: ['a', 'b', 'c'], paragraph: 'p', full: 'The full depth.' },
          section_ordinal: 1,
          anchor: { page: 4 },
        },
      ],
      reviews: [{ artefact_id: 'a1', reviewed_at: '2026-07-20T00:00:00.000Z', rating: 3, due_at: '2026-08-01T00:00:00.000Z' }],
    },
  ],
}

describe('bundleToMarkdown', () => {
  it('titles the document with the course', () => {
    const markdown = bundleToMarkdown(bundle)

    expect(markdown).toMatch(/# Optics/)
  })

  it('lists sources and their sections', () => {
    const markdown = bundleToMarkdown(bundle)

    expect(markdown).toMatch(/Chapter 1/)
    expect(markdown).toMatch(/Light bends\./)
  })

  it('renders every format as readable text', () => {
    const markdown = bundleToMarkdown(bundle)

    expect(markdown).toMatch(/What bends light\?/)
    expect(markdown).toMatch(/A change of medium\./)
    expect(markdown).toMatch(/Light ____ at a boundary\./)
    expect(markdown).toMatch(/bends/)
    expect(markdown).toMatch(/A prism/)
    expect(markdown).toMatch(/Explain refraction\./)
    expect(markdown).toMatch(/The bending of light\./)
    expect(markdown).toMatch(/The full depth\./)
  })

  it('marks the correct option on a multiple choice card', () => {
    const markdown = bundleToMarkdown(bundle)

    expect(markdown).toMatch(/\*\*A prism\*\*/)
  })

  it('summarises the review history per artefact', () => {
    const markdown = bundleToMarkdown(bundle)

    expect(markdown).toMatch(/1 review/);
    expect(markdown).toMatch(/rated 3/i);
  })

  it('says so when a course has nothing yet', () => {
    const markdown = bundleToMarkdown({
      exported_at: '2026-07-26T00:00:00.000Z',
      courses: [{ subject: { id: 's2', title: 'Empty' }, sources: [], concepts: [], artefacts: [], reviews: [] }],
    })

    expect(markdown).toMatch(/# Empty/)
    expect(markdown).toMatch(/nothing/i)
  })
})
