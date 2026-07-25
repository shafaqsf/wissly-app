// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from '../data/fake-supabase.js'
import {
  READ_ONLY_TOOLS,
  dueTasks,
  listCourses,
  listReading,
  listSources,
  listTasks,
  readSection,
  searchEverything,
  searchSections,
} from './tools.js'

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

describe('listSources', () => {
  it('returns the shelf with each section’s anchor, and no whole documents', async () => {
    const supabase = fakeSupabase({
      sources: { data: [{ id: 'src1', subject_id: 'sub1', kind: 'pdf', title: 'Probability' }], error: null },
      sections: {
        data: [
          {
            id: 's1',
            source_id: 'src1',
            ordinal: 1,
            content: 'x'.repeat(5000),
            anchor: { page: 1 },
          },
        ],
        error: null,
      },
    })

    const [source] = await listSources(supabase, { subjectId: 'sub1' })

    expect(source).toMatchObject({ source_id: 'src1', title: 'Probability' })
    expect(source.sections[0]).toMatchObject({ section_id: 's1', anchor: { page: 1 } })
    // A shelf listing that inlined every page would be the whole library in
    // the context window, which is the one thing a listing must not be.
    expect(source.sections[0].preview.length).toBeLessThan(400)
  })
})

describe('listTasks', () => {
  it('reads only the four answered formats', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [], error: null } })

    await listTasks(supabase, { subjectId: 'sub1' })

    expect(argsOf(supabase.query('artefacts'), 'in')[1].sort()).toEqual([
      'cloze',
      'flashcard',
      'multiple_choice',
      'open_question',
    ])
  })

  it('narrows to one type when asked', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [], error: null } })

    await listTasks(supabase, { subjectId: 'sub1', format: 'cloze' })

    expect(argsOf(supabase.query('artefacts'), 'in')[1]).toEqual(['cloze'])
  })

  it('refuses to list reading as though it were a task', async () => {
    await expect(
      listTasks(fakeSupabase(), { subjectId: 'sub1', format: 'summary' }),
    ).rejects.toThrow(/task/i)
  })
})

describe('listReading', () => {
  it('reads only what is read rather than answered', async () => {
    const supabase = fakeSupabase({ artefacts: { data: [], error: null } })

    await listReading(supabase, { subjectId: 'sub1' })

    expect(argsOf(supabase.query('artefacts'), 'in')[1].sort()).toEqual([
      'glossary',
      'summary',
    ])
  })
})

describe('dueTasks', () => {
  it('reads the queue, bounded', async () => {
    const supabase = fakeSupabase({
      artefact_schedule: { data: [], error: null },
    })

    await dueTasks(supabase, { limit: 500 })

    expect(argsOf(supabase.query('artefact_schedule'), 'limit')[0]).toBeLessThanOrEqual(30)
  })
})

describe('searchEverything', () => {
  it('searches without a model call, over everything at once', async () => {
    const supabase = fakeSupabase({
      search_index: {
        data: [
          {
            kind: 'section',
            id: 's1',
            subject_id: 'sub1',
            parent_id: 'src1',
            title: 'Martingales',
            snippet: 'a fair game',
            created_at: '2026-07-01',
          },
        ],
        error: null,
      },
    })

    const hits = await searchEverything(supabase, { query: 'martingale' })

    expect(hits[0]).toMatchObject({ kind: 'section', id: 's1' })
    expect(supabase.query('search_index')).toBeTruthy()
  })
})

describe('READ_ONLY_TOOLS', () => {
  it('is what chat mode holds, and none of it writes', () => {
    expect(READ_ONLY_TOOLS.map((definition) => definition.name).sort()).toEqual([
      'due_tasks',
      'list_courses',
      'list_reading',
      'list_sources',
      'list_tasks',
      'read_section',
      'search_everything',
      'search_sections',
    ])
  })

  it('describes every tool, because the description is the model’s only manual', () => {
    for (const definition of READ_ONLY_TOOLS) {
      expect(definition.description.length, definition.name).toBeGreaterThan(20)
    }
  })

  it('refuses the wrong identity before it reads a single row', async () => {
    const privileged = { supabaseKey: 'sb_secret_abc', from: () => {
      throw new Error('the query was built, which is already too late')
    } }

    for (const definition of READ_ONLY_TOOLS) {
      await expect(
        definition.run(privileged, { query: 'x', sectionId: 's1', subjectId: 'sub1' }),
        definition.name,
      ).rejects.toThrow(/as the learner/i)
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
  const dir = join(process.cwd(), 'src', 'lib', 'agent')
  const sources = readdirSync(dir).filter(
    (name) => name.endsWith('.js') && !name.endsWith('.test.js'),
  )

  it('is never mentioned anywhere under src/lib/agent', () => {
    for (const name of sources) {
      const body = readFileSync(join(dir, name), 'utf8')
      expect(body, name).not.toMatch(/SUPABASE_SECRET_KEY|service_role/)
    }
  })

  /* Auth and export are the two acts no undo restores: one changes who the
   * learner is, the other carries their data out of the account. Export exists
   * as a learner feature precisely because it leaves; a tool that could
   * trigger it would hand that decision to a poisoned PDF. */
  it('reaches neither auth nor export from any module under src/lib/agent', () => {
    for (const name of sources) {
      const body = readFileSync(join(dir, name), 'utf8')
      expect(body, name).not.toMatch(
        /supabase\.auth|\.auth\.(signOut|updateUser|admin|resetPasswordForEmail|signInWith)/,
      )
      expect(body, name).not.toMatch(/deleteAccount|exportCourse|exportDeck|createShareLink/)
    }
  })
})
