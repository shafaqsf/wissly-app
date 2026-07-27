// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { markAllNotificationsRead, markNotificationRead, requireUserId, revalidatePath } = vi.hoisted(() => ({
  markAllNotificationsRead: vi.fn(async () => []),
  markNotificationRead: vi.fn(async () => ({ id: 'n1' })),
  requireUserId: vi.fn(async () => 'user-1'),
  revalidatePath: vi.fn(),
}))

const supabase = {}

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => supabase) }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/data/notifications.js', () => ({ markAllNotificationsRead, markNotificationRead }))

import { markAllNotificationsReadAction, markNotificationReadAction } from './notifications.js'

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('marking one notification read', () => {
  it('requires a signed-in learner and stamps the row they asked for', async () => {
    await markNotificationReadAction(form({ id: 'n1' }))

    expect(requireUserId).toHaveBeenCalledWith(supabase)
    expect(markNotificationRead).toHaveBeenCalledWith(supabase, { id: 'n1' })
  })

  it('refreshes every page under the frame the bell renders in', async () => {
    await markNotificationReadAction(form({ id: 'n1' }))

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'layout')
  })

  it('does nothing without an id', async () => {
    await markNotificationReadAction(form({}))

    expect(markNotificationRead).not.toHaveBeenCalled()
  })
})

describe('marking every notification read', () => {
  it('requires a signed-in learner and stamps every unread row', async () => {
    await markAllNotificationsReadAction()

    expect(requireUserId).toHaveBeenCalledWith(supabase)
    expect(markAllNotificationsRead).toHaveBeenCalledWith(supabase)
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'layout')
  })
})
