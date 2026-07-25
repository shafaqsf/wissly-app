import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from '../data/fake-supabase.js'
import { READ_ONLY_TOOLS, listCourses, readSection, searchSections } from './tools.js'

describe('searchSections', () => {
  it('carries the anchor back with every hit', async () => {
    const supabase = fakeSupabase({
      sections: {
        data: [
          {
            id: 's1',
            ordinal: 4,
            content: 'A martingale is a fair game.',
            anchor: { page: 12 },
            sources: { id: 'src1', title: 'Probability', subject_id: 'sub1' },
          },
        ],
        error: null,
      },
    })

    const hits = await searchSections(supabase, { query: 'martingale' })

    expect(hits[0]).toMatchObject({
      section_id: 's1',
      anchor: { page: 12 },
      source_title: 'Probability',
    })
  })

  it('searches the content and nothing else', async () => {
    const supabase = fakeSupabase({ sections: { data: [], error: null } })

    await searchSections(supabase, { query: "o'brien" })

    expect(argsOf(supabase.query('sections'), 'ilike')).toEqual([
      'content',
      "%o'brien%",
    ])
  })

  it('bounds what one call can pull into the context window', async () => {
    const supabase = fakeSupabase({ sections: { data: [], error: null } })

    await searchSections(supabase, { query: 'x', limit: 500 })

    expect(argsOf(supabase.query('sections'), 'limit')[0]).toBeLessThanOrEqual(20)
  })

  it('refuses an empty query rather than returning the whole library', async () => {
    const supabase = fakeSupabase()

    await expect(searchSections(supabase, { query: '  ' })).rejects.toThrow(/search/i)
  })
})

describe('readSection', () => {
  it('returns the passage with its anchor', async () => {
    const supabase = fakeSupabase({
      sections: {
        data: {
          id: 's1',
          ordinal: 4,
          content: 'A martingale is a fair game.',
          anchor: { page: 12 },
          sources: { id: 'src1', title: 'Probability', subject_id: 'sub1' },
        },
        error: null,
      },
    })

    expect(await readSection(supabase, { sectionId: 's1' })).toMatchObject({
      section_id: 's1',
      anchor: { page: 12 },
      content: 'A martingale is a fair game.',
    })
  })

  it('says so plainly when the section is not the learner’s to read', async () => {
    const supabase = fakeSupabase({ sections: { data: null, error: null } })

    await expect(readSection(supabase, { sectionId: 'nope' })).rejects.toThrow(
      /not found/i,
    )
  })
})

describe('listCourses', () => {
  it('reads the learner’s courses', async () => {
    const supabase = fakeSupabase({
      subjects: { data: [{ id: 'sub1', title: 'Probability' }], error: null },
    })

    expect(await listCourses(supabase)).toEqual([
      { id: 'sub1', title: 'Probability' },
    ])
  })
})

describe('READ_ONLY_TOOLS', () => {
  it('is what chat mode holds, and none of it writes', () => {
    expect(READ_ONLY_TOOLS.map((definition) => definition.name).sort()).toEqual([
      'list_courses',
      'read_section',
      'search_sections',
    ])
  })

  it('describes every tool, because the description is the model’s only manual', () => {
    for (const definition of READ_ONLY_TOOLS) {
      expect(definition.description.length, definition.name).toBeGreaterThan(20)
    }
  })
})

describe('the agent and the secret key', () => {
  /* The single most important assertion in the suite. The agent reads
   * uploaded PDFs, which is to say attacker-controlled input, by design. It
   * must reach the database through the learner's own session so that row
   * level security bounds the damage a prompt injection can do to that
   * learner's own account. The secret key bypasses RLS entirely and would
   * turn a poisoned lecture handout into everyone's data. */
  it('is never mentioned anywhere under src/lib/agent', () => {
    const dir = join(process.cwd(), 'src', 'lib', 'agent')
    const files = ['tools.js', 'runtime.js', 'agents.js']

    for (const name of files) {
      const body = readFileSync(join(dir, name), 'utf8')
      expect(body, name).not.toMatch(/SUPABASE_SECRET_KEY|service_role/)
    }
  })
})
