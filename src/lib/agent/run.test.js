// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { argsOf, fakeSupabase } from '../data/fake-supabase.js'
import { runTurn } from './run.js'

/* The agent is never called here. What is under test is the bookkeeping
 * around it: which rows exist while it works, what happens to them when it
 * finishes, and what happens to them when it does not. */

const conversation = { id: 'c1', mode: 'chat' }
const message = { id: 'm1', content: 'what is a martingale?' }

function supabaseFor({ queued = null, actions = [], messageRows = [] } = {}) {
  return fakeSupabase({
    messages: [
      { data: { id: 'answer', status: 'running' }, error: null }, // insert
      { data: [message], error: null }, // history
      ...messageRows,
      { data: { id: 'answer', status: 'done' }, error: null }, // final status
      { data: queued, error: null }, // the queue
    ],
    agent_runs: [
      { data: { id: 'r1' }, error: null },
      { data: { id: 'r1', status: 'done' }, error: null },
    ],
    agent_actions: { data: actions, error: null },
    conversations: { data: null, error: null },
  })
}

const configure = () => ({ model: 'anthropic/claude-opus-5' })
const createAgent = () => ({ name: 'Librarian' })

/** Every update issued against a table, newest last. */
function updates(supabase, table) {
  return supabase
    .queries(table)
    .flatMap((call) => call.chain.filter((step) => step.method === 'update'))
    .map((step) => step.args[0])
}

const lastUpdate = (supabase, table) => updates(supabase, table).at(-1)

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

    expect(lastUpdate(supabase, 'messages')).toMatchObject({
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

    expect(lastUpdate(supabase, 'agent_runs')).toMatchObject({ status: 'done' })
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
    expect(lastUpdate(supabase, 'messages')).toMatchObject({ status: 'failed' })
    expect(lastUpdate(supabase, 'messages').content).toMatch(/provider is down/)
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

    expect(lastUpdate(supabase, 'messages').content).toMatch(/which passage it came from/)
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

    expect(lastUpdate(supabase, 'agent_runs')).toMatchObject({ status: 'failed' })
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

describe('the model, per message', () => {
  it('uses the one this message chose', async () => {
    const supabase = supabaseFor()
    const models = []

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message: { ...message, model: 'deepseek/deepseek-v4-pro' },
      createAgent: ({ model }) => {
        models.push(model)
        return { name: 'Librarian' }
      },
      runAgent: async () => ({ finalOutput: 'ok [s:a]' }),
      configure,
    })

    expect(models[0]).toBe('deepseek/deepseek-v4-pro')
    expect(argsOf(supabase.queries('agent_runs')[0], 'insert')[0].model).toBe(
      'deepseek/deepseek-v4-pro',
    )
  })

  it('falls back to the configured default for a learner who never chose', async () => {
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

    expect(argsOf(supabase.queries('agent_runs')[0], 'insert')[0].model).toBe(
      'anthropic/claude-opus-5',
    )
  })

  it('records the model on the answer, so the transcript can say who answered', async () => {
    const supabase = supabaseFor()

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message: { ...message, model: 'openai/gpt-5.6-luna' },
      runAgent: async () => ({ finalOutput: 'ok [s:a]' }),
      createAgent,
      configure,
    })

    expect(argsOf(supabase.queries('messages')[0], 'insert')[0].model).toBe(
      'openai/gpt-5.6-luna',
    )
  })

  it('refuses a model id that is not one, before the run row exists', async () => {
    const supabase = supabaseFor()

    await expect(
      runTurn({
        supabase,
        userId: 'u1',
        conversation,
        message: { ...message, model: 'claude' },
        runAgent: async () => ({ finalOutput: 'ok' }),
        createAgent,
        configure,
      }),
    ).rejects.toThrow(/vendor\/model/i)

    expect(supabase.calls).toHaveLength(0)
  })

  it('takes chat on one model while the agent works on another', async () => {
    // Two turns in one thread, two models, and neither is a function of mode.
    for (const [mode, model] of [
      ['chat', 'anthropic/claude-sonnet-5'],
      ['agent', 'deepseek/deepseek-v4-pro'],
    ]) {
      const supabase = supabaseFor()

      await runTurn({
        supabase,
        userId: 'u1',
        conversation: { ...conversation, mode },
        message: { ...message, model },
        runAgent: async () => ({ finalOutput: 'ok [s:a]' }),
        createAgent,
        configure,
        createClient: () => ({}),
      })

      expect(argsOf(supabase.queries('agent_runs')[0], 'insert')[0]).toMatchObject({
        mode,
        model,
      })
    }
  })
})

describe('streaming', () => {
  /** A scripted stream, in the shape the SDK emits. */
  async function* deltas(...pieces) {
    for (const piece of pieces) {
      yield { type: 'raw_model_stream_event', data: { type: 'output_text_delta', delta: piece } }
    }
  }

  const streamOf = (...pieces) => {
    const stream = deltas(...pieces)
    return { [Symbol.asyncIterator]: () => stream, finalOutput: pieces.join('') }
  }

  it('hands every delta to whoever is listening, as it arrives', async () => {
    const supabase = supabaseFor({
      messageRows: [
        { data: { id: 'answer' }, error: null },
        { data: { id: 'answer' }, error: null },
      ],
    })
    const seen = []

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => streamOf('A fair ', 'game. ', '[s:abc]'),
      createAgent,
      configure,
      onEvent: (event) => seen.push(event),
    })

    expect(seen.filter((event) => event.type === 'delta').map((event) => event.text)).toEqual([
      'A fair ',
      'game. ',
      '[s:abc]',
    ])
    expect(seen.at(-1)).toMatchObject({ type: 'done' })
  })

  it('persists what has arrived, so reconnecting resumes from what is stored', async () => {
    const supabase = supabaseFor({
      messageRows: [
        { data: { id: 'answer' }, error: null },
        { data: { id: 'answer' }, error: null },
        { data: { id: 'answer' }, error: null },
      ],
    })

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => streamOf('A fair ', 'game. ', '[s:abc]'),
      createAgent,
      configure,
      // Every delta, so the test is about what is written rather than when.
      persistEveryMs: 0,
    })

    const written = updates(supabase, 'messages').map((patch) => patch.content)

    expect(written).toContain('A fair ')
    expect(written).toContain('A fair game. ')
    expect(written.at(-1)).toBe('A fair game. [s:abc]')
  })

  it('assembles the answer from the deltas when there is no final output', async () => {
    const supabase = supabaseFor({
      messageRows: [
        { data: { id: 'answer' }, error: null },
        { data: { id: 'answer' }, error: null },
      ],
    })

    const { message: answer } = await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => {
        const stream = deltas('Half ', 'an answer. [s:a]')
        return { [Symbol.asyncIterator]: () => stream }
      },
      createAgent,
      configure,
    })

    expect(answer).toBeTruthy()
    expect(lastUpdate(supabase, 'messages')).toMatchObject({
      status: 'done',
      content: 'Half an answer. [s:a]',
    })
  })

  it('still works for a model that hands back the whole answer at once', async () => {
    const supabase = supabaseFor()
    const seen = []

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => ({ finalOutput: 'All at once. [s:a]' }),
      createAgent,
      configure,
      onEvent: (event) => seen.push(event),
    })

    expect(lastUpdate(supabase, 'messages').content).toBe('All at once. [s:a]')
    expect(seen.at(-1)).toMatchObject({ type: 'done' })
  })
})

describe('stop', () => {
  async function* forever() {
    for (let index = 0; index < 100; index += 1) {
      yield { type: 'raw_model_stream_event', data: { type: 'output_text_delta', delta: 'x' } }
    }
  }

  it('ends the turn and marks it stopped', async () => {
    const supabase = supabaseFor({
      // One persisted write per event until the third check stops the run.
      messageRows: Array.from({ length: 3 }, () => ({ data: { id: 'answer' }, error: null })),
    })
    let seen = 0

    const { run } = await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => {
        const stream = forever()
        return { [Symbol.asyncIterator]: () => stream }
      },
      createAgent,
      configure,
      shouldStop: async () => {
        seen += 1
        return seen > 2
      },
      persistEveryMs: 0,
    })

    expect(lastUpdate(supabase, 'agent_runs')).toMatchObject({ status: 'stopped' })
    expect(run).toBeTruthy()
  })

  it('keeps what the answer had got to rather than throwing it away', async () => {
    const supabase = supabaseFor({
      // One persisted write per event until the third check stops the run.
      messageRows: Array.from({ length: 3 }, () => ({ data: { id: 'answer' }, error: null })),
    })
    let seen = 0

    await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => {
        const stream = forever()
        return { [Symbol.asyncIterator]: () => stream }
      },
      createAgent,
      configure,
      shouldStop: async () => {
        seen += 1
        return seen > 2
      },
      persistEveryMs: 0,
    })

    const final = lastUpdate(supabase, 'messages')
    expect(final.status).toBe('stopped')
    expect(final.content.length).toBeGreaterThan(0)
  })

  /* The one the design calls out by name. A learner who queues a follow-up
   * and then stops the turn in flight has asked for the turn to end, not for
   * the thing they just typed to be thrown away. */
  it('leaves a queued message queued, so it survives the stop', async () => {
    const supabase = supabaseFor({
      queued: { id: 'm2', content: 'and next?' },
      // Stopped at the first check, so exactly one delta was written down.
      messageRows: [{ data: { id: 'answer' }, error: null }],
    })

    const { next } = await runTurn({
      supabase,
      userId: 'u1',
      conversation,
      message,
      runAgent: async () => {
        const stream = forever()
        return { [Symbol.asyncIterator]: () => stream }
      },
      createAgent,
      configure,
      shouldStop: async () => true,
      persistEveryMs: 0,
    })

    expect(next).toMatchObject({ id: 'm2' })

    // Nothing in this turn touched the queued row's status.
    const withdrawn = updates(supabase, 'messages').filter(
      (patch) => patch.status === 'stopped' && patch.content === undefined,
    )
    expect(withdrawn).toHaveLength(0)
  })
})

describe('a run that dies halfway', () => {
  /* Thirty writes in, the provider drops the connection. Which of the thirty
   * landed is not a detail: without it, Undo is guesswork and the learner is
   * left comparing their library against their memory of it. */
  it('reports which writes completed', async () => {
    const supabase = supabaseFor({
      actions: [
        { id: 'x1', tool: 'make_artefacts', result: { ids: ['a1', 'a2'] }, undo: {} },
        { id: 'x2', tool: 'rename_course', result: { title: 'Optics' }, undo: {} },
      ],
    })

    const { message: answer, completed } = await runTurn({
      supabase,
      userId: 'u1',
      conversation: { ...conversation, mode: 'agent' },
      message,
      runAgent: async () => {
        throw new Error('the connection dropped')
      },
      createAgent,
      configure,
      createClient: () => ({}),
    })

    expect(completed).toEqual(['make_artefacts', 'rename_course'])
    expect(answer).toBeTruthy()

    const written = lastUpdate(supabase, 'messages').content
    expect(written).toMatch(/the connection dropped/)
    expect(written).toMatch(/2 changes/)
    expect(written).toMatch(/make_artefacts/)
    expect(written).toMatch(/undo/i)
  })

  it('says plainly that nothing landed when nothing did', async () => {
    const supabase = supabaseFor({ actions: [] })

    const { completed } = await runTurn({
      supabase,
      userId: 'u1',
      conversation: { ...conversation, mode: 'agent' },
      message,
      runAgent: async () => {
        throw new Error('boom')
      },
      createAgent,
      configure,
      createClient: () => ({}),
    })

    expect(completed).toEqual([])
    expect(lastUpdate(supabase, 'messages').content).toMatch(/nothing was changed/i)
  })

  it('carries the same list back on the run row, for the surface that reads runs', async () => {
    const supabase = supabaseFor({
      actions: [{ id: 'x1', tool: 'archive_tasks', result: { archived: 4 }, undo: {} }],
    })

    await runTurn({
      supabase,
      userId: 'u1',
      conversation: { ...conversation, mode: 'agent' },
      message,
      runAgent: async () => {
        throw new Error('boom')
      },
      createAgent,
      configure,
      createClient: () => ({}),
    })

    expect(lastUpdate(supabase, 'agent_runs').error).toMatch(/archive_tasks/)
  })
})

describe('navigation intents', () => {
  it('collects what the agent asked the interface to do, for the bar to perform', async () => {
    const supabase = supabaseFor()
    const seen = []

    const { intents } = await runTurn({
      supabase,
      userId: 'u1',
      conversation: { ...conversation, mode: 'agent' },
      message,
      createAgent: ({ onIntent }) => {
        onIntent({ kind: 'navigate', path: '/tasks', query: { type: 'flashcard' } })
        return { name: 'Router' }
      },
      runAgent: async () => ({ finalOutput: 'Made them. [s:a]' }),
      configure,
      createClient: () => ({}),
      onEvent: (event) => seen.push(event),
    })

    expect(intents).toEqual([
      { kind: 'navigate', path: '/tasks', query: { type: 'flashcard' } },
    ])
    expect(seen.some((event) => event.type === 'intent')).toBe(true)
  })
})

describe('a standing order’s run', () => {
  it('is stamped as one, so the dashboard can say what happened unattended', async () => {
    const supabase = supabaseFor()

    await runTurn({
      supabase,
      userId: 'u1',
      conversation: { ...conversation, mode: 'agent' },
      message,
      trigger: 'schedule',
      runAgent: async () => ({ finalOutput: 'Topped up. [s:a]' }),
      createAgent,
      configure,
      createClient: () => ({}),
    })

    expect(updates(supabase, 'agent_runs')[0]).toMatchObject({ trigger: 'schedule' })
  })

  it('leaves an ordinary turn unstamped rather than writing the default twice', async () => {
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

    expect(updates(supabase, 'agent_runs').some((patch) => 'trigger' in patch)).toBe(false)
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

    expect(updates(supabase, 'agent_runs').map((patch) => patch.status)).toContain('failed')
  })
})

describe('the agent’s identity', () => {
  it('refuses to run at all with a client that bypasses row level security', async () => {
    await expect(
      runTurn({
        supabase: { supabaseKey: 'sb_secret_abc', from: () => vi.fn() },
        userId: 'u1',
        conversation,
        message,
        runAgent: async () => ({ finalOutput: 'ok' }),
        createAgent,
        configure,
      }),
    ).rejects.toThrow(/as the learner/i)
  })
})
