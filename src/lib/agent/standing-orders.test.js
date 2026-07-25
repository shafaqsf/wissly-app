// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { argsOf, fakeSupabase } from '../data/fake-supabase.js'
import {
  dueStandingOrders,
  intervalMs,
  isDue,
  runDueStandingOrders,
  runStandingOrder,
} from './standing-orders.js'

const now = new Date('2026-07-25T09:00:00.000Z')

const order = {
  id: 'o1',
  instruction: 'Top up any concept below half mastery.',
  schedule: 'daily',
  enabled: true,
  last_run_at: null,
}

describe('intervalMs', () => {
  it('reads the phrases a learner would write', () => {
    expect(intervalMs('hourly')).toBe(60 * 60 * 1000)
    expect(intervalMs('daily')).toBe(24 * 60 * 60 * 1000)
    expect(intervalMs('weekly')).toBe(7 * 24 * 60 * 60 * 1000)
    expect(intervalMs('every 3 days')).toBe(3 * 24 * 60 * 60 * 1000)
    expect(intervalMs('Every 90 minutes')).toBe(90 * 60 * 1000)
  })

  it('says it cannot read a schedule rather than guessing at one', () => {
    expect(intervalMs('when I feel like it')).toBeNull()
    expect(intervalMs('')).toBeNull()
  })
})

describe('isDue', () => {
  it('runs an order that has never run', () => {
    expect(isDue(order, { now })).toBe(true)
  })

  it('waits out the interval', () => {
    expect(
      isDue({ ...order, last_run_at: '2026-07-25T08:00:00.000Z' }, { now }),
    ).toBe(false)
    expect(
      isDue({ ...order, last_run_at: '2026-07-24T08:00:00.000Z' }, { now }),
    ).toBe(true)
  })

  it('never runs an order that is switched off', () => {
    expect(isDue({ ...order, enabled: false }, { now })).toBe(false)
  })

  it('never runs an order whose schedule cannot be read', () => {
    expect(isDue({ ...order, schedule: 'sometimes' }, { now })).toBe(false)
  })
})

describe('dueStandingOrders', () => {
  it('returns what is due, least recently run first', async () => {
    const supabase = fakeSupabase({
      standing_orders: {
        data: [
          { ...order, id: 'o1', last_run_at: '2026-07-24T08:00:00.000Z' },
          { ...order, id: 'o2', last_run_at: null },
          { ...order, id: 'o3', last_run_at: '2026-07-25T08:30:00.000Z' },
          { ...order, id: 'o4', enabled: false },
        ],
        error: null,
      },
    })

    expect((await dueStandingOrders(supabase, { now })).map((row) => row.id)).toEqual([
      'o2',
      'o1',
    ])
  })
})

describe('runStandingOrder', () => {
  function supabaseFor({ threads = [] } = {}) {
    return fakeSupabase({
      conversations: [
        { data: threads, error: null }, // the list, looking for this order's thread
        { data: { id: 'c9', mode: 'agent' }, error: null }, // created, if there was none
        { data: null, error: null }, // last_message_at
      ],
      messages: { data: { id: 'm9' }, error: null },
      standing_orders: { data: { ...order, last_run_at: now.toISOString() }, error: null },
    })
  }

  const runTurn = () => vi.fn(async () => ({ message: { id: 'answer' }, run: { id: 'r1' } }))

  it('posts the instruction into a thread and runs it as the agent', async () => {
    const supabase = supabaseFor()
    const turn = runTurn()

    await runStandingOrder({ supabase, userId: 'u1', order, now, runTurn: turn })

    const [{ conversation, message, trigger }] = turn.mock.calls[0]

    // `conversation_id` is NOT NULL and stays that way: everything the agent
    // did is in one thread, whether a person asked for it or a schedule did.
    expect(conversation.id).toBeTruthy()
    expect(conversation.mode).toBe('agent')
    expect(message).toBeTruthy()
    expect(trigger).toBe('schedule')

    // The instruction is posted as the learner's own message: it is something
    // they said in advance, and the transcript reads like every other thread.
    const written = argsOf(supabase.query('messages'), 'insert')[0]
    expect(written.role).toBe('user')
    expect(written.content).toContain(order.instruction)
    expect(written.mode).toBe('agent')
    expect(written.status).toBe('running')
  })

  it('reuses the order’s own thread rather than opening one a week', async () => {
    const supabase = supabaseFor({
      threads: [{ id: 'c1', title: 'Standing order — Top up any concept below half mastery.', mode: 'agent' }],
    })
    const turn = runTurn()

    await runStandingOrder({ supabase, userId: 'u1', order, now, runTurn: turn })

    expect(turn.mock.calls[0][0].conversation.id).toBe('c1')
    expect(supabase.queries('conversations').some((call) =>
      call.chain.some((step) => step.method === 'insert'),
    )).toBe(false)
  })

  it('stamps the order as run', async () => {
    const supabase = supabaseFor()

    await runStandingOrder({ supabase, userId: 'u1', order, now, runTurn: runTurn() })

    expect(argsOf(supabase.queries('standing_orders')[0], 'update')[0]).toHaveProperty(
      'last_run_at',
    )
  })

  it('stamps it even when the turn failed, so a broken order does not run every tick', async () => {
    const supabase = supabaseFor()

    const result = await runStandingOrder({
      supabase,
      userId: 'u1',
      order,
      now,
      runTurn: async () => {
        throw new Error('the provider is down')
      },
    })

    expect(result.error).toMatch(/provider is down/)
    expect(argsOf(supabase.queries('standing_orders')[0], 'update')[0]).toHaveProperty(
      'last_run_at',
    )
  })
})

describe('runDueStandingOrders', () => {
  function supabaseFor(orders) {
    return fakeSupabase({
      standing_orders: [
        { data: orders, error: null },
        { data: orders[0], error: null },
      ],
      conversations: [
        { data: [], error: null },
        { data: { id: 'c9', mode: 'agent' }, error: null },
        { data: null, error: null },
      ],
      messages: { data: { id: 'm9' }, error: null },
    })
  }

  it('executes one, because a tick is not a place to empty a queue', async () => {
    const supabase = supabaseFor([
      { ...order, id: 'o1' },
      { ...order, id: 'o2' },
    ])
    const turn = vi.fn(async () => ({ message: { id: 'answer' }, run: { id: 'r1' } }))

    const result = await runDueStandingOrders({ supabase, userId: 'u1', now, runTurn: turn })

    expect(turn).toHaveBeenCalledTimes(1)
    expect(result.ran).toHaveLength(1)
    expect(result.ran[0].standing_order_id).toBe('o1')
    expect(result.due).toBe(2)
  })

  it('does nothing, cheaply, when nothing is due', async () => {
    const supabase = supabaseFor([
      { ...order, id: 'o1', last_run_at: '2026-07-25T08:00:00.000Z' },
    ])
    const turn = vi.fn()

    const result = await runDueStandingOrders({ supabase, userId: 'u1', now, runTurn: turn })

    expect(turn).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ran: [], due: 0 })
  })

  it('refuses to act with a client that bypasses row level security', async () => {
    await expect(
      runDueStandingOrders({
        supabase: { supabaseKey: 'sb_secret_abc', from: () => {} },
        userId: 'u1',
        now,
      }),
    ).rejects.toThrow(/as the learner/i)
  })
})
