// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import {
  createNotification,
  latestNotificationOfKind,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from './notifications.js'

const NOW = new Date('2026-07-26T09:00:00.000Z')

describe('listing notifications', () => {
  it('reads the most recent first, capped to a bell-sized page', async () => {
    const supabase = fakeSupabase({ notifications: { data: [], error: null } })

    await listNotifications(supabase, { limit: 20 })

    const call = supabase.query('notifications')
    expect(argsOf(call, 'order')).toEqual(['created_at', { ascending: false }])
    expect(argsOf(call, 'limit')).toEqual([20])
  })

  it('treats no rows as an empty list', async () => {
    const supabase = fakeSupabase({ notifications: { data: null, error: null } })

    expect(await listNotifications(supabase)).toEqual([])
  })
})

describe('the unread count the bell badges with', () => {
  it('counts only what has no read_at', async () => {
    const supabase = fakeSupabase({ notifications: { data: [{ id: 'n1' }, { id: 'n2' }], error: null } })

    const count = await unreadNotificationCount(supabase)

    const call = supabase.query('notifications')
    expect(argsOf(call, 'is')).toEqual(['read_at', null])
    expect(count).toBe(2)
  })

  it('is zero rather than null when nothing is unread', async () => {
    const supabase = fakeSupabase({ notifications: { data: null, error: null } })

    expect(await unreadNotificationCount(supabase)).toBe(0)
  })
})

describe('writing a notification', () => {
  it('carries the kind, the words, and whatever data the decision produced', async () => {
    const supabase = fakeSupabase({ notifications: { data: { id: 'n1' }, error: null } })

    await createNotification(supabase, {
      userId: 'user-1',
      kind: 'review_due',
      title: '8 reviews are due',
      body: 'A few minutes now keeps them from slipping further.',
      data: { dueCount: 8, avgRetrievability: 0.7 },
    })

    const [row] = argsOf(supabase.query('notifications'), 'insert')
    expect(row).toMatchObject({
      user_id: 'user-1',
      kind: 'review_due',
      title: '8 reviews are due',
      data: { dueCount: 8, avgRetrievability: 0.7 },
    })
  })
})

describe('reading the last notification of a kind', () => {
  it('is what the reminder decision compares itself against', async () => {
    const supabase = fakeSupabase({ notifications: { data: null, error: null } })

    await latestNotificationOfKind(supabase, { kind: 'review_due' })

    const call = supabase.query('notifications')
    expect(argsOf(call, 'eq')).toEqual(['kind', 'review_due'])
    expect(argsOf(call, 'order')).toEqual(['created_at', { ascending: false }])
  })

  it('is null when this kind has never been sent', async () => {
    const supabase = fakeSupabase({ notifications: { data: null, error: null } })

    expect(await latestNotificationOfKind(supabase, { kind: 'review_due' })).toBeNull()
  })
})

describe('marking notifications read', () => {
  it('stamps read_at on one notification', async () => {
    const supabase = fakeSupabase({ notifications: { data: { id: 'n1' }, error: null } })

    await markNotificationRead(supabase, { id: 'n1', now: () => NOW })

    const call = supabase.query('notifications')
    expect(argsOf(call, 'update')).toEqual([{ read_at: NOW.toISOString() }])
    expect(argsOf(call, 'eq')).toEqual(['id', 'n1'])
  })

  it('stamps every unread row at once, not one at a time', async () => {
    const supabase = fakeSupabase({ notifications: { data: [{ id: 'n1' }, { id: 'n2' }], error: null } })

    await markAllNotificationsRead(supabase, { now: () => NOW })

    const call = supabase.query('notifications')
    expect(argsOf(call, 'update')).toEqual([{ read_at: NOW.toISOString() }])
    expect(argsOf(call, 'is')).toEqual(['read_at', null])
  })
})
