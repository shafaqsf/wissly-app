// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { fakeSupabase } from '../data/fake-supabase.js'
import { READ_ONLY_TOOLS } from './tools.js'
import { WRITE_TOOLS } from './write-tools.js'
import {
  LIBRARIAN_INSTRUCTIONS,
  ROLES,
  STEWARD_INSTRUCTIONS,
  TOOLS_BY_ROLE,
  agentForMode,
  anchorGuardrail,
  citedSections,
  createExaminer,
  createLibrarian,
  createMaker,
  createRouter,
  createSteward,
  missingAnchors,
} from './agents.js'

const context = () => ({
  supabase: fakeSupabase(),
  model: 'a/b',
  userId: 'u1',
  runId: 'r1',
  client: {},
})

const named = (agent) => agent.tools.map((definition) => definition.name).sort()

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
  it('holds every reading tool and nothing that writes', () => {
    const agent = createLibrarian(context())

    expect(named(agent)).toEqual(READ_ONLY_TOOLS.map((d) => d.name).sort())

    const writes = WRITE_TOOLS.map((definition) => definition.name)
    for (const name of named(agent)) expect(writes).not.toContain(name)
  })

  it('carries the guardrail that keeps the citation promise', () => {
    expect(createLibrarian(context()).outputGuardrails).toHaveLength(1)
  })

  it('is told to stop rather than improvise when the material is silent', () => {
    expect(LIBRARIAN_INSTRUCTIONS).toMatch(/say\s+so plainly and stop/)
  })

  it('is told the exact citation syntax the interface renders', () => {
    expect(LIBRARIAN_INSTRUCTIONS).toContain('[s:SECTION_ID]')
  })
})

describe('the specialists', () => {
  it('gives the Maker what it needs to generate and nothing to grade with', () => {
    const agent = createMaker(context())

    expect(named(agent)).toContain('make_artefacts')
    expect(named(agent)).toContain('write_artefact')
    expect(named(agent)).not.toContain('record_review')
  })

  it('gives the Examiner what it needs to grade and nothing to generate with', () => {
    const agent = createExaminer(context())

    expect(named(agent)).toContain('due_tasks')
    expect(named(agent)).toContain('grade_answer')
    expect(named(agent)).toContain('record_review')
    expect(named(agent)).not.toContain('make_artefacts')
  })

  it('gives the Steward the whole surface, because it acts for the learner', () => {
    expect(named(createSteward(context()))).toEqual(
      [...READ_ONLY_TOOLS, ...WRITE_TOOLS].map((definition) => definition.name).sort(),
    )
  })

  it('refuses to build any writing agent with no run to attribute actions to', () => {
    for (const create of [createMaker, createExaminer, createSteward, createRouter]) {
      expect(() => create({ ...context(), runId: undefined }), create.name).toThrow(/run/i)
    }
  })

  it('lets no specialist reach auth or export', () => {
    for (const create of [createLibrarian, createMaker, createExaminer, createSteward]) {
      for (const name of named(create(context()))) {
        expect(name, `${create.name}: ${name}`).not.toMatch(
          /email|password|account|auth|export|share|sign_?out/i,
        )
      }
    }
  })
})

describe('the router', () => {
  it('holds no tools of its own and hands off to the four', () => {
    const agent = createRouter(context())

    expect(agent.tools ?? []).toHaveLength(0)
    expect(agent.handoffs.map((handoff) => handoff.name ?? handoff.agentName).sort()).toEqual([
      'Examiner',
      'Librarian',
      'Maker',
      'Steward',
    ])
  })
})

describe('the mode switch', () => {
  it('gives chat mode an agent that holds nothing which writes', () => {
    const agent = agentForMode({ ...context(), mode: 'chat' })

    expect(agent.name).toBe('Librarian')
    for (const definition of WRITE_TOOLS) {
      expect(named(agent)).not.toContain(definition.name)
    }
  })

  it('gives agent mode the router, which can reach the writing tools', () => {
    const agent = agentForMode({ ...context(), mode: 'agent' })

    expect(agent.name).toBe('Router')
  })

  it('treats an unknown mode as chat, the one that cannot write', () => {
    expect(agentForMode({ ...context(), mode: 'root' }).name).toBe('Librarian')
  })

  it('refuses to build a writing agent with no run to attribute actions to', () => {
    expect(() => agentForMode({ ...context(), mode: 'agent', runId: undefined })).toThrow(/run/i)
  })

  it('takes the model it is handed, so mode and model stay independent', () => {
    expect(agentForMode({ ...context(), mode: 'chat', model: 'anthropic/claude-sonnet-5' }).model).toBe(
      'anthropic/claude-sonnet-5',
    )
    expect(
      agentForMode({ ...context(), mode: 'agent', model: 'deepseek/deepseek-v4-pro' }).model,
    ).toBe('deepseek/deepseek-v4-pro')
  })

  it('tells the steward to read before it writes', () => {
    expect(STEWARD_INSTRUCTIONS).toMatch(/Read before you write/)
  })
})

describe('TOOLS_BY_ROLE', () => {
  it('documents what each role may do, which is what the bar explains to the learner', () => {
    expect(Object.keys(TOOLS_BY_ROLE).sort()).toEqual([...ROLES].sort())

    for (const [role, tools] of Object.entries(TOOLS_BY_ROLE)) {
      expect(tools.length, role).toBeGreaterThan(0)
    }
  })

  it('names only tools that exist', () => {
    const all = [...READ_ONLY_TOOLS, ...WRITE_TOOLS].map((definition) => definition.name)

    for (const [role, tools] of Object.entries(TOOLS_BY_ROLE)) {
      for (const name of tools) expect(all, `${role}: ${name}`).toContain(name)
    }
  })
})
