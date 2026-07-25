// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { argsOf, fakeSupabase } from '@/lib/data/fake-supabase.js'
import { addMaterial } from './add-material.js'

/* Adding material ingests and files. It does not generate.
 *
 * This used to be the path that made up to twelve model calls on upload and
 * decided, without asking, that section 3 deserved a flashcard. The client
 * below is a tripwire: every method fails the test if anything reaches for
 * it, which is the one property this file exists to hold. */
function forbiddenClient() {
  return {
    chatStructured: vi.fn(() => {
      throw new Error('adding material must not call a model')
    }),
    chat: vi.fn(() => {
      throw new Error('adding material must not call a model')
    }),
  }
}

function supabaseFor({ sections, concepts }) {
  return fakeSupabase({
    subjects: { data: { id: 'sub-1', title: 'Optics' }, error: null },
    sources: { data: { id: 'src-1', title: 'Notes' }, error: null },
    sections: { data: sections, error: null },
    concepts: { data: concepts, error: null },
  })
}

const material = {
  subject: 'Optics',
  title: 'Notes',
  kind: 'text',
  text: 'Refraction\n\nLight bends at a boundary.\n\nSnell\n\nThe angle follows a law.',
}

const twoSections = {
  sections: [
    { id: 'sec-1', ordinal: 1, content: 'Light bends at a boundary.', anchor: {} },
    { id: 'sec-2', ordinal: 2, content: 'The angle follows a law.', anchor: {} },
  ],
  concepts: [
    { id: 'c1', section_id: 'sec-1' },
    { id: 'c2', section_id: 'sec-2' },
  ],
}

describe('adding material', () => {
  it('makes no model call', async () => {
    const supabase = supabaseFor(twoSections)
    const client = forbiddenClient()

    await addMaterial({ supabase, client, userId: 'user-1', material })

    expect(client.chatStructured).not.toHaveBeenCalled()
    expect(client.chat).not.toHaveBeenCalled()
  })

  it('writes nothing to artefacts — generating is a thing the learner asks for', async () => {
    const supabase = supabaseFor(twoSections)

    await addMaterial({ supabase, client: forbiddenClient(), userId: 'user-1', material })

    expect(supabase.queries('artefacts')).toEqual([])
  })

  it('works without a model client at all', async () => {
    const supabase = supabaseFor(twoSections)

    const result = await addMaterial({ supabase, userId: 'user-1', material })

    expect(result.source).toEqual({ id: 'src-1', title: 'Notes' })
    expect(result.sections).toHaveLength(2)
    expect(result.concepts).toHaveLength(2)
  })

  it("carries one learner's id from the subject through to the concepts", async () => {
    const supabase = supabaseFor(twoSections)

    await addMaterial({ supabase, client: forbiddenClient(), userId: 'user-1', material })

    for (const table of ['sources', 'sections', 'concepts']) {
      const [payload] = argsOf(supabase.query(table), 'insert')
      const rows = Array.isArray(payload) ? payload : [payload]
      expect(rows.every((row) => row.user_id === 'user-1'), table).toBe(true)
    }
  })

  it('stores every section there is, however many that comes to', async () => {
    const sections = Array.from({ length: 15 }, (_, index) => ({
      id: `sec-${index + 1}`,
      ordinal: index + 1,
      content: `Paragraph ${index + 1}.`,
      anchor: {},
    }))
    const supabase = supabaseFor({
      sections,
      concepts: sections.map((section, index) => ({
        id: `c${index + 1}`,
        section_id: section.id,
      })),
    })

    const result = await addMaterial({
      supabase,
      client: forbiddenClient(),
      userId: 'user-1',
      material: { ...material, text: sections.map((s) => s.content).join('\n\n') },
    })

    const [stored] = argsOf(supabase.query('sections'), 'insert')
    expect(stored).toHaveLength(15)
    expect(result.sections).toHaveLength(15)
  })

  it('refuses material with nothing readable in it', async () => {
    const supabase = fakeSupabase()

    await expect(
      addMaterial({
        supabase,
        client: forbiddenClient(),
        userId: 'user-1',
        material: { ...material, text: '   ' },
      }),
    ).rejects.toThrow(/no readable text/i)

    expect(supabase.calls).toHaveLength(0)
  })
})
