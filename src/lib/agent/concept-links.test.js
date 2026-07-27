// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { suggestConceptLinks } from './concept-links.js'

const concepts = [
  { id: 'c-1', term: 'Refraction', definition: 'Light bending at a boundary.' },
  { id: 'c-2', term: 'Photosynthesis', definition: 'Plants turning light into sugar.' },
]

const candidates = [
  { id: 'x-1', term: 'Snell\'s law', definition: 'The angle a ray bends by.', courseTitle: 'Optics' },
  { id: 'x-2', term: 'Cellular respiration', definition: 'Sugar turning into energy.', courseTitle: 'Biology' },
  { id: 'x-3', term: 'Baroque music', definition: 'A period of composition.', courseTitle: 'Music history' },
]

/** A client whose structured call is scripted. */
function stubClient(answer) {
  return { chatStructured: vi.fn(async () => answer), chat: vi.fn() }
}

describe('suggestConceptLinks', () => {
  it('maps the tokens the model returns back to concept ids', async () => {
    const client = stubClient({
      links: [
        { concept: 'a1', related: 'b1', reason: 'Both are about how light bends.' },
        { concept: 'a2', related: 'b2', reason: 'Both describe the same energy conversion.' },
      ],
    })

    const links = await suggestConceptLinks({ client, concepts, candidates })

    expect(links).toEqual([
      { conceptId: 'c-1', relatedConceptId: 'x-1', reason: 'Both are about how light bends.' },
      { conceptId: 'c-2', relatedConceptId: 'x-2', reason: 'Both describe the same energy conversion.' },
    ])
  })

  it('asks nothing when either side is empty', async () => {
    const client = stubClient({ links: [] })

    await expect(suggestConceptLinks({ client, concepts: [], candidates })).resolves.toEqual([])
    await expect(suggestConceptLinks({ client, concepts, candidates: [] })).resolves.toEqual([])
    expect(client.chatStructured).not.toHaveBeenCalled()
  })

  it('drops a pair whose token the model invented', async () => {
    const client = stubClient({
      links: [{ concept: 'a1', related: 'b9', reason: 'Made up.' }],
    })

    await expect(suggestConceptLinks({ client, concepts, candidates })).resolves.toEqual([])
  })

  it('drops a second answer for the same pair', async () => {
    const client = stubClient({
      links: [
        { concept: 'a1', related: 'b1', reason: 'First reason.' },
        { concept: 'a1', related: 'b1', reason: 'Second reason.' },
      ],
    })

    const links = await suggestConceptLinks({ client, concepts, candidates })

    expect(links).toHaveLength(1)
  })

  it('puts every concept and candidate in the prompt, with the candidate\'s course named', async () => {
    const client = stubClient({ links: [] })
    await suggestConceptLinks({ client, concepts, candidates })

    const { messages } = client.chatStructured.mock.calls[0][0]
    const prompt = messages.at(-1).content

    expect(prompt).toContain('Refraction')
    expect(prompt).toContain("Snell's law")
    expect(prompt).toContain('Optics')
  })

  it('constrains the schema to a bounded list of pairs', async () => {
    const client = stubClient({ links: [] })
    await suggestConceptLinks({ client, concepts, candidates })

    const { schema } = client.chatStructured.mock.calls[0][0]
    expect(schema.properties.links.items.required).toEqual(['concept', 'related', 'reason'])
  })
})
