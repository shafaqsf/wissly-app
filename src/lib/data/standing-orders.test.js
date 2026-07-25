// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase, methodsOf } from './fake-supabase.js'
import {
  createStandingOrder,
  deleteStandingOrder,
  listStandingOrders,
  markStandingOrderRun,
  setStandingOrderEnabled,
  updateStandingOrder,
} from './standing-orders.js'

const order = {
  id: 'so-1',
  instruction: 'Generate cards for anything below grain 2',
  schedule: 'weekly',
  enabled: true,
}

describe('listing standing orders', () => {
  it('reads them newest first', async () => {
    const supabase = fakeSupabase({ standing_orders: { data: [order], error: null } })

    await expect(listStandingOrders(supabase)).resolves.toEqual([order])
    expect(argsOf(supabase.query('standing_orders'), 'order')).toEqual([
      'created_at',
      { ascending: false },
    ])
  })

  it('can ask for only the ones that are switched on', async () => {
    const supabase = fakeSupabase({ standing_orders: { data: [], error: null } })

    await listStandingOrders(supabase, { enabled: true })

    expect(argsOf(supabase.query('standing_orders'), 'eq')).toEqual(['enabled', true])
  })
})

describe('creating a standing order', () => {
  it('stamps the owner and switches it on by default', async () => {
    const supabase = fakeSupabase({ standing_orders: { data: order, error: null } })

    await createStandingOrder(supabase, {
      userId: 'user-1',
      instruction: '  Generate cards for anything below grain 2  ',
      schedule: 'weekly',
    })

    expect(argsOf(supabase.query('standing_orders'), 'insert')).toEqual([
      {
        user_id: 'user-1',
        instruction: 'Generate cards for anything below grain 2',
        schedule: 'weekly',
        enabled: true,
      },
    ])
  })

  it('refuses an order with nothing in it — the agent would act on nothing', async () => {
    const supabase = fakeSupabase()

    await expect(
      createStandingOrder(supabase, { userId: 'user-1', instruction: '   ', schedule: 'weekly' }),
    ).rejects.toThrow(/instruction/i)

    expect(supabase.calls).toHaveLength(0)
  })

  it('refuses an order with no schedule — nothing would ever run it', async () => {
    const supabase = fakeSupabase()

    await expect(
      createStandingOrder(supabase, { userId: 'user-1', instruction: 'Do a thing', schedule: '' }),
    ).rejects.toThrow(/schedule/i)
  })
})

describe('changing a standing order', () => {
  it('writes only what was passed', async () => {
    const supabase = fakeSupabase({ standing_orders: { data: order, error: null } })

    await updateStandingOrder(supabase, { id: 'so-1', schedule: 'daily' })

    expect(argsOf(supabase.query('standing_orders'), 'update')).toEqual([{ schedule: 'daily' }])
    expect(argsOf(supabase.query('standing_orders'), 'eq')).toEqual(['id', 'so-1'])
  })

  it('switches one off without touching its instruction', async () => {
    const supabase = fakeSupabase({ standing_orders: { data: order, error: null } })

    await setStandingOrderEnabled(supabase, { id: 'so-1', enabled: false })

    expect(argsOf(supabase.query('standing_orders'), 'update')).toEqual([{ enabled: false }])
  })

  it('stamps when it last ran', async () => {
    const supabase = fakeSupabase({ standing_orders: { data: order, error: null } })
    const now = () => new Date('2026-07-25T09:00:00.000Z')

    await markStandingOrderRun(supabase, { id: 'so-1', now })

    expect(argsOf(supabase.query('standing_orders'), 'update')).toEqual([
      { last_run_at: '2026-07-25T09:00:00.000Z' },
    ])
  })
})

describe('removing a standing order', () => {
  it('takes the row away — there is nothing here to archive', async () => {
    const supabase = fakeSupabase({ standing_orders: { data: null, error: null } })

    await expect(deleteStandingOrder(supabase, { id: 'so-1' })).resolves.toEqual({ id: 'so-1' })
    expect(methodsOf(supabase.query('standing_orders'))).toContain('delete')
  })
})
