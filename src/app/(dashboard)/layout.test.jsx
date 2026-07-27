import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ensureReviewReminder, getClaims, listNotifications, redirect, unreadNotificationCount } = vi.hoisted(
  () => ({
    ensureReviewReminder: vi.fn(async () => null),
    getClaims: vi.fn(),
    listNotifications: vi.fn(async () => []),
    redirect: vi.fn((url) => {
      throw new Error(`NEXT_REDIRECT:${url}`)
    }),
    unreadNotificationCount: vi.fn(async () => 0),
  }),
)

vi.mock('@/lib/supabase/server.js', () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}))
// The shell reads the current path to mark its nav; only `redirect` is
// under test here.
vi.mock('next/navigation', () => ({ redirect, usePathname: () => '/dashboard' }))
vi.mock('@/lib/auth/actions.js', () => ({ signOut: vi.fn() }))
vi.mock('@/lib/notifications/ensure-review-reminder.js', () => ({ ensureReviewReminder }))
vi.mock('@/lib/data/notifications.js', () => ({ listNotifications, unreadNotificationCount }))
// The bell's server actions reach the database through next/headers, which
// has nothing to read outside a real request; the bell's own test file
// covers what they are called with.
vi.mock('@/lib/actions/notifications.js', () => ({
  markAllNotificationsReadAction: vi.fn(async () => {}),
  markNotificationReadAction: vi.fn(async () => {}),
}))

import DashboardLayout from './layout'

beforeEach(() => {
  vi.clearAllMocks()
  getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null })
  ensureReviewReminder.mockResolvedValue(null)
  listNotifications.mockResolvedValue([])
  unreadNotificationCount.mockResolvedValue(0)
})

describe('the dashboard frame', () => {
  it('turns a signed-out visitor away itself, not only in the proxy', async () => {
    getClaims.mockResolvedValue({ data: null, error: null })

    await expect(DashboardLayout({ children: null })).rejects.toThrow(
      'NEXT_REDIRECT:/sign-in',
    )
  })

  it('shows the learner their page and a way to every other one', async () => {
    render(await DashboardLayout({ children: <p>Your subjects</p> }))

    expect(screen.getByText('Your subjects')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })

  // Signing out is an account action and lives on the settings page. Under
  // every page's content it would appear twice on that one.
  it('does not carry a sign-out button under every page', async () => {
    render(await DashboardLayout({ children: <p>Your subjects</p> }))

    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('checks the learner in against their own queue before rendering', async () => {
    render(await DashboardLayout({ children: <p>Your subjects</p> }))

    expect(ensureReviewReminder).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1' })
  })

  it('gives the bell the unread count and recent notifications it needs', async () => {
    unreadNotificationCount.mockResolvedValue(3)
    listNotifications.mockResolvedValue([
      {
        id: 'n1',
        title: '8 reviews are due',
        body: 'A few minutes now keeps them from slipping further.',
        created_at: '2026-07-26T09:00:00.000Z',
        read_at: null,
      },
    ])

    render(await DashboardLayout({ children: <p>Your subjects</p> }))

    expect(screen.getByRole('button', { name: /notifications.*3 unread/i })).toBeInTheDocument()
  })

  it('still renders the page when checking the queue fails', async () => {
    ensureReviewReminder.mockRejectedValue(new Error('boom'))

    render(await DashboardLayout({ children: <p>Your subjects</p> }))

    expect(screen.getByText('Your subjects')).toBeInTheDocument()
  })
})
