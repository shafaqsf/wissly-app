import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}))
vi.mock('@/lib/auth/actions.js', () => ({ signOut: vi.fn() }))
// The weekly report preview's server action reaches the database through
// next/headers, which has nothing to read outside a real request; its own
// test file covers what it does.
vi.mock('@/lib/actions/weekly-report.js', () => ({
  sendWeeklyReportAction: vi.fn(async () => ({})),
}))

import SettingsPage from './page'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the settings page', () => {
  it('tells the learner which account they are signed in as', async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', email: 'learner@example.com' } },
      error: null,
    })

    render(await SettingsPage())

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText('learner@example.com')).toBeInTheDocument()
  })

  it('is where signing out lives', async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', email: 'learner@example.com' } },
      error: null,
    })

    render(await SettingsPage())

    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('still signs out an account whose token carries no address', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null })

    render(await SettingsPage())

    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.getByText('No address on this account')).toBeInTheDocument()
  })

  it('is where the weekly report can be previewed', async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', email: 'learner@example.com' } },
      error: null,
    })

    render(await SettingsPage())

    expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument()
  })
})
