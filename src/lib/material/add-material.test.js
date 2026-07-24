// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { argsOf, fakeSupabase } from '@/lib/data/fake-supabase.js'
import { SECTION_LIMIT, addMaterial } from './add-material.js'

/* A client that picks flashcard for every section and then writes one.
   Generating an artefact costs two structured calls — choose the format, then
   fill it — so the stand-in answers according to which was asked. What the
   model says is the agent layer's business and is tested there; what matters
   here is that whatever it says reaches the right table with an owner and a
   concept on it. */
function fakeClient() {
  return {
    chatStructured: vi.fn(async ({ schemaName }) =>
      schemaName === 'format_choice'
        ? { format: 'flashcard', reason: 'one fact worth recalling' }
        : { front: 'What bends?', back: 'Light.' },
    ),
    chat: vi.fn(),
  }
}

/** How many structured calls one artefact costs: the choice and the writing. */
const CALLS_PER_ARTEFACT = 2

function supabaseFor({ sections, concepts, artefacts }) {
  return fakeSupabase({
    subjects: { data: { id: 'sub-1', title: 'Optics' }, error: null },
    sources: { data: { id: 'src-1', title: 'Notes' }, error: null },
    sections: { data: sections, error: null },
    concepts: { data: concepts, error: null },
    artefacts: { data: artefacts, error: null },
  })
}

const material = {
  subject: 'Optics',
  title: 'Notes',
  kind: 'text',
  text: 'Refraction\n\nLight bends at a boundary.\n\nSnell\n\nThe angle follows a law.',
}

describe('adding material', () => {
  it('carries one learner\'s id from the subject all the way to the artefacts', async () => {
    const supabase = supabaseFor({
      sections: [
        { id: 'sec-1', ordinal: 1, content: 'Light bends at a boundary.', anchor: {} },
        { id: 'sec-2', ordinal: 2, content: 'The angle follows a law.', anchor: {} },
      ],
      concepts: [
        { id: 'c1', section_id: 'sec-1' },
        { id: 'c2', section_id: 'sec-2' },
      ],
      artefacts: [{ id: 'a1' }, { id: 'a2' }],
    })

    await addMaterial({ supabase, client: fakeClient(), userId: 'user-1', material })

    for (const table of ['sources', 'sections', 'concepts', 'artefacts']) {
      const [payload] = argsOf(supabase.query(table), 'insert')
      const rows = Array.isArray(payload) ? payload : [payload]
      expect(rows.every((row) => row.user_id === 'user-1'), table).toBe(true)
    }
  })

  it('links each artefact to the concept its section named', async () => {
    const supabase = supabaseFor({
      sections: [
        { id: 'sec-1', ordinal: 1, content: 'Light bends at a boundary.', anchor: {} },
        { id: 'sec-2', ordinal: 2, content: 'The angle follows a law.', anchor: {} },
      ],
      concepts: [
        { id: 'c1', section_id: 'sec-1' },
        { id: 'c2', section_id: 'sec-2' },
      ],
      artefacts: [{ id: 'a1' }, { id: 'a2' }],
    })

    await addMaterial({ supabase, client: fakeClient(), userId: 'user-1', material })

    const [rows] = argsOf(supabase.query('artefacts'), 'insert')
    expect(rows.map((row) => row.concept_id)).toEqual(['c1', 'c2'])
    expect(rows.map((row) => row.section_id)).toEqual(['sec-1', 'sec-2'])
  })

  it('refuses material with nothing readable in it before spending a model call', async () => {
    const supabase = fakeSupabase()
    const client = fakeClient()

    await expect(
      addMaterial({
        supabase,
        client,
        userId: 'user-1',
        material: { ...material, text: '   ' },
      }),
    ).rejects.toThrow(/no readable text/i)

    expect(client.chatStructured).not.toHaveBeenCalled()
    expect(supabase.calls).toHaveLength(0)
  })

  it('stores every section but generates from a bounded number, and says how many it left', async () => {
    const sections = Array.from({ length: SECTION_LIMIT + 3 }, (_, index) => ({
      id: `sec-${index + 1}`,
      ordinal: index + 1,
      content: `Paragraph ${index + 1}.`,
      anchor: {},
    }))
    const supabase = supabaseFor({
      sections,
      concepts: sections.map((section, index) => ({ id: `c${index + 1}`, section_id: section.id })),
      artefacts: [],
    })
    const client = fakeClient()

    const result = await addMaterial({
      supabase,
      client,
      userId: 'user-1',
      material: {
        ...material,
        text: sections.map((section) => section.content).join('\n\n'),
      },
    })

    expect(result.skipped).toBe(3)
    expect(client.chatStructured).toHaveBeenCalledTimes(SECTION_LIMIT * CALLS_PER_ARTEFACT)

    const [stored] = argsOf(supabase.query('sections'), 'insert')
    expect(stored).toHaveLength(SECTION_LIMIT + 3)
  })

  it('keeps the sections a failing model call would have thrown away', async () => {
    const supabase = supabaseFor({
      sections: [
        { id: 'sec-1', ordinal: 1, content: 'Light bends at a boundary.', anchor: {} },
        { id: 'sec-2', ordinal: 2, content: 'The angle follows a law.', anchor: {} },
      ],
      concepts: [
        { id: 'c1', section_id: 'sec-1' },
        { id: 'c2', section_id: 'sec-2' },
      ],
      artefacts: [{ id: 'a1' }],
    })
    const client = fakeClient()
    // The first section's format choice never comes back; the second is fine.
    client.chatStructured.mockRejectedValueOnce(new Error('rate limited'))

    const result = await addMaterial({ supabase, client, userId: 'user-1', material })

    expect(result.failures).toHaveLength(1)
    const [rows] = argsOf(supabase.query('artefacts'), 'insert')
    expect(rows).toHaveLength(1)
  })
})
