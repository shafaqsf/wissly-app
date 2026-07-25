import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from '../data/fake-supabase.js'
import { runTurn } from './run.js'

/* The agent is never called here. What is under test is the bookkeeping
 * around it: which rows exist while it works, what happens to them when it
 * finishes, and what happens to them when it does not. */

const conversation = { id: 'c1', mode: 'chat' }
const message = { id: 'm1', content: 'what is a martingale?' }

function supabaseFor({ queued = null } = {}) {
  return fakeSupabase({
    messages: [
      { data: { id: 'answer', status: 'running' }, error: null }, // insert
      { data: [message], error: null }, // history
      { data: { id: 'answer', status: 'done' }, error: null }, // final status
      { data: queued, error: null }, // the queue
    ],
    agent_runs: [
      { data: { id: 'r1' }, error: null },
      { data: { id: 'r1', status: 'done' }, error: null },
    ],
    conversations: { data: null, error: null },
  })
}

const configure = () => ({ model: 'anthropic/claude-opus-5' })
const createAgent = () => ({ name: 'Librarian' })

describe('runTurn', () => {
  it('writes the answer row before asking the agent anything', async () => {
    const supabase = supabaseFor()

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => ({ finalOutput: 'A fair game. [s:abc]' }),
      createAgent,
      configure,
    })

    const insert = supabase.queries('messages')[0]
    expect(argsOf(insert, 'insert')[0]).toMatchObject({
      role: 'assistant',
      status: 'running',
    })
    // The row exists first, so a reload mid-run finds the question answered
    // by a working state rather than by nothing.
    expect(supabase.calls.indexOf(insert)).toBe(0)
  })

  it('stores the anchors the answer cited', async () => {
    const supabase = supabaseFor()

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => ({ finalOutput: 'A fair game. [s:abc] And [s:def]' }),
      createAgent,
      configure,
    })

    const update = supabase
      .queries('messages')
      .find((call) => call.chain.some((step) => step.method === 'update'))

    expect(argsOf(update, 'update')[0]).toMatchObject({
      status: 'done',
      anchors: [{ section_id: 'abc' }, { section_id: 'def' }],
    })
  })

  it('ends the run, so the queue behind it can move', async () => {
    const supabase = supabaseFor()

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => ({ finalOutput: 'ok [s:a]' }),
      createAgent,
      configure,
    })

    const update = supabase
      .queries('agent_runs')
      .find((call) => call.chain.some((step) => step.method === 'update'))

    expect(argsOf(update, 'update')[0]).toMatchObject({ status: 'done' })
  })

  it('hands back the next queued message', async () => {
    const supabase = supabaseFor({ queued: { id: 'm2', content: 'and next?' } })

    const { next } = await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => ({ finalOutput: 'ok [s:a]' }),
      createAgent,
      configure,
    })

    expect(next).toMatchObject({ id: 'm2' })
  })

  it('reports a failure in the thread rather than losing it', async () => {
    const supabase = supabaseFor()

    const { message: answer } = await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => {
        throw new Error('provider is down')
      },
      createAgent,
      configure,
    })

    expect(answer).toBeTruthy()
    const update = supabase
      .queries('messages')
      .find((call) => call.chain.some((step) => step.method === 'update'))
    expect(argsOf(update, 'update')[0]).toMatchObject({ status: 'failed' })
    expect(argsOf(update, 'update')[0].content).toMatch(/provider is down/)
  })

  it('explains a withheld answer as what it is, not as a crash', async () => {
    const supabase = supabaseFor()

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => {
        throw new Error('Output guardrail tripped')
      },
      createAgent,
      configure,
    })

    const update = supabase
      .queries('messages')
      .find((call) => call.chain.some((step) => step.method === 'update'))
    expect(argsOf(update, 'update')[0].content).toMatch(/which passage it came from/)
  })

  it('ends the run even when the agent threw', async () => {
    const supabase = supabaseFor()

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => {
        throw new Error('boom')
      },
      createAgent,
      configure,
    })

    const update = supabase
      .queries('agent_runs')
      .find((call) => call.chain.some((step) => step.method === 'update'))
    expect(argsOf(update, 'update')[0]).toMatchObject({ status: 'failed' })
  })

  it('counts passages as tools answer, so the guardrail sees the real number', async () => {
    const supabase = supabaseFor()
    const counters = []

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      createAgent: ({ passagesRead }) => {
        counters.push(passagesRead)
        return { name: 'Librarian' }
      },
      runAgent: async (_agent, _input, options) => {
        options.onToolResult()
        options.onToolResult()
        return { finalOutput: 'ok [s:a]' }
      },
      configure,
    })

    expect(counters[0]()).toBe(2)
  })

  it('names the model on the run row, because the model is the cost', async () => {
    const supabase = supabaseFor()

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => ({ finalOutput: 'ok [s:a]' }),
      createAgent,
      configure,
    })

    expect(argsOf(supabase.queries('agent_runs')[0], 'insert')[0]).toMatchObject({
      model: 'anthropic/claude-opus-5',
      mode: 'chat',
      agent: 'Librarian',
    })
  })
})

describe('a stopped provider', () => {
  it('does not leave the run at running, which would block the thread forever', async () => {
    const supabase = supabaseFor()

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => {
        throw new Error('timeout')
      },
      createAgent,
      configure,
    })

    const statuses = supabase
      .queries('agent_runs')
      .flatMap((call) => call.chain.filter((step) => step.method === 'update'))
      .map((step) => step.args[0].status)

    expect(statuses).toContain('failed')
  })
})
