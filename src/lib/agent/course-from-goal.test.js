// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import {
  draftCourseOutline,
  generatedAnchor,
  sectionsFromOutline,
} from './course-from-goal.js'

const outline = {
  title: 'Eigenvalues for the linear algebra exam',
  sections: [
    { heading: 'What an eigenvector is', content: 'An eigenvector of A is a nonzero v with Av = λv.' },
    { heading: 'Finding eigenvalues', content: 'Solve det(A - λI) = 0.' },
  ],
}

function stubClient(...answers) {
  const chatStructured = vi.fn(async () => answers.shift() ?? {})
  return { chatStructured, chat: vi.fn() }
}

describe('draftCourseOutline', () => {
  it('drafts a title and a small number of parts from a stated goal', async () => {
    const client = stubClient(outline)

    await expect(
      draftCourseOutline({ client, goal: 'I want to understand eigenvalues for my exam' }),
    ).resolves.toEqual(outline)
  })

  it('puts the goal in the prompt', async () => {
    const client = stubClient(outline)

    await draftCourseOutline({ client, goal: 'eigenvalues for my exam' })

    const prompt = client.chatStructured.mock.calls[0][0].messages.at(-1).content
    expect(prompt).toContain('eigenvalues for my exam')
  })

  it('bounds how many parts one goal can draft', async () => {
    const client = stubClient(outline)

    await draftCourseOutline({ client, goal: 'x', maxSections: 3 })

    const { schema } = client.chatStructured.mock.calls[0][0]
    expect(schema.properties.sections.maxItems).toBe(3)
  })

  it('refuses an empty goal without spending a call', async () => {
    const client = stubClient(outline)

    await expect(draftCourseOutline({ client, goal: '   ' })).rejects.toThrow(/say what you want to learn/i)
    expect(client.chatStructured).not.toHaveBeenCalled()
  })
})

describe('generatedAnchor', () => {
  it('is honestly not a page or an offset', () => {
    expect(generatedAnchor('What an eigenvector is')).toEqual({
      generated: true,
      heading: 'What an eigenvector is',
    })
  })

  it('carries no heading when none was given', () => {
    expect(generatedAnchor()).toEqual({ generated: true })
  })
})

describe('sectionsFromOutline', () => {
  it('produces the same section shape ingestion produces, so the storage path is identical', () => {
    const sections = sectionsFromOutline(outline)

    expect(sections).toEqual([
      {
        ordinal: 1,
        content: 'An eigenvector of A is a nonzero v with Av = λv.',
        anchor: { generated: true, heading: 'What an eigenvector is' },
      },
      {
        ordinal: 2,
        content: 'Solve det(A - λI) = 0.',
        anchor: { generated: true, heading: 'Finding eigenvalues' },
      },
    ])
  })

  it('never produces a page or character-offset anchor — that would claim a source that does not exist', () => {
    for (const section of sectionsFromOutline(outline)) {
      expect(section.anchor).not.toHaveProperty('page')
      expect(section.anchor).not.toHaveProperty('start')
      expect(section.anchor.generated).toBe(true)
    }
  })

  it('produces nothing for an empty outline', () => {
    expect(sectionsFromOutline({ sections: [] })).toEqual([])
  })
})
