import { describe, expect, it } from 'vitest'

import { fakeSupabase } from '../data/fake-supabase.js'
import {
  LIBRARIAN_INSTRUCTIONS,
  STEWARD_INSTRUCTIONS,
  agentForMode,
  anchorGuardrail,
  citedSections,
  createLibrarian,
  missingAnchors,
} from './agents.js'

describe('missingAnchors', () => {
  it('rejects an answer that read the material and cited none of it', () => {
    expect(
      missingAnchors({ answer: 'A martingale is a fair game.', passagesRead: 2 }),
    ).toBe(true)
  })

  it('accepts an answer that says where it came from', () => {
    expect(
      missingAnchors({
        answer: 'A martingale is a fair game. [s:9f2a-11]',
        passagesRead: 2,
      }),
    ).toBe(false)
  })

  it('leaves an answer alone when there was nothing to cite', () => {
    expect(
      missingAnchors({
        answer: 'I could not find that in your material.',
        passagesRead: 0,
      }),
    ).toBe(false)
  })
})

describe('citedSections', () => {
  it('reads the ids out in the order they were cited', () => {
    expect(citedSections('One [s:aaa] and two [s:bbb] and one again [s:aaa]')).toEqual([
      'aaa',
      'bbb',
      'aaa',
    ])
  })

  it('finds nothing in prose that cites nothing', () => {
    expect(citedSections('no anchors here')).toEqual([])
  })
})

describe('anchorGuardrail', () => {
  it('trips on an uncited answer, in the shape the SDK reads', async () => {
    const guardrail = anchorGuardrail(() => 3)

    expect(await guardrail.execute({ agentOutput: 'Bare claim.' })).toMatchObject({
      tripwireTriggered: true,
      outputInfo: { passagesRead: 3 },
    })
  })

  it('does not trip when the answer carries its anchor', async () => {
    const guardrail = anchorGuardrail(() => 3)

    expect(
      await guardrail.execute({ agentOutput: 'Claim. [s:abc]' }),
    ).toMatchObject({ tripwireTriggered: false })
  })

  it('counts the passages at the time it runs, not when it was built', async () => {
    let read = 0
    const guardrail = anchorGuardrail(() => read)

    expect(await guardrail.execute({ agentOutput: 'Bare.' })).toMatchObject({
      tripwireTriggered: false,
    })

    read = 1
    expect(await guardrail.execute({ agentOutput: 'Bare.' })).toMatchObject({
      tripwireTriggered: true,
    })
  })
})

describe('the librarian', () => {
  it('holds the three read-only tools and nothing that writes', () => {
    const agent = createLibrarian({ supabase: fakeSupabase(), model: 'a/b' })

    expect(agent.tools.map((definition) => definition.name).sort()).toEqual([
      'list_courses',
      'read_section',
      'search_sections',
    ])
  })

  it('carries the guardrail that keeps the citation promise', () => {
    const agent = createLibrarian({ supabase: fakeSupabase(), model: 'a/b' })

    expect(agent.outputGuardrails).toHaveLength(1)
  })

  it('is told to stop rather than improvise when the material is silent', () => {
    expect(LIBRARIAN_INSTRUCTIONS).toMatch(/say\s+so plainly and stop/)
  })

  it('is told the exact citation syntax the interface renders', () => {
    expect(LIBRARIAN_INSTRUCTIONS).toContain('[s:SECTION_ID]')
  })
})

describe('the mode switch', () => {
  it('gives chat mode an agent that holds nothing which writes', () => {
    const agent = agentForMode({ mode: 'chat', supabase: fakeSupabase(), model: 'a/b' })

    expect(agent.name).toBe('Librarian')
    expect(agent.tools.map((definition) => definition.name)).not.toContain('rename_course')
    expect(agent.tools.map((definition) => definition.name)).not.toContain('make_artefacts')
  })

  it('gives agent mode the writing tools as well as the reading ones', () => {
    const agent = agentForMode({
      mode: 'agent',
      supabase: fakeSupabase(),
      model: 'a/b',
      userId: 'u1',
      runId: 'r1',
      client: {},
    })

    expect(agent.name).toBe('Steward')
    expect(agent.tools.map((definition) => definition.name).sort()).toEqual([
      'list_courses',
      'make_artefacts',
      'read_section',
      'rename_course',
      'search_sections',
    ])
  })

  it('refuses to build a writing agent with no run to attribute actions to', () => {
    expect(() =>
      agentForMode({ mode: 'agent', supabase: fakeSupabase(), model: 'a/b', userId: 'u1' }),
    ).toThrow(/run/i)
  })

  it('treats an unknown mode as chat, the one that cannot write', () => {
    expect(agentForMode({ mode: 'root', supabase: fakeSupabase(), model: 'a/b' }).name).toBe(
      'Librarian',
    )
  })

  it('tells the steward to read before it writes', () => {
    expect(STEWARD_INSTRUCTIONS).toMatch(/Read before you write/)
  })
})
