import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}))
vi.mock('@/lib/auth/actions.js', () => ({ signOut: vi.fn() }))
vi.mock('@/lib/data/preferences.js', () => ({
  getPreferences: vi.fn(async () => ({ user_id: 'user-1', default_model: null, updated_at: null })),
}))
vi.mock('@/lib/actions/settings.js', () => ({ updateDefaultModelAction: vi.fn() }))
vi.mock('@/lib/actions/export.js', () => ({
  exportDataAction: vi.fn(),
  importDataAction: vi.fn(),
}))

import { getPreferences } from '@/lib/data/preferences.js'

import SettingsPage from './page'

beforeEach(() => {
  vi.clearAllMocks()
  getPreferences.mockResolvedValue({ user_id: 'user-1', default_model: null, updated_at: null })
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

  it('is where the model generation uses lives', async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', email: 'learner@example.com' } },
      error: null,
    })

    render(await SettingsPage())

    expect(screen.getByRole('heading', { name: 'Model' })).toBeInTheDocument()
    expect(screen.getByLabelText(/model for generation/i)).toBeInTheDocument()
  })

  it('is where a course or the whole library can be exported and imported', async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', email: 'learner@example.com' } },
      error: null,
    })

    render(await SettingsPage())

    expect(screen.getByRole('heading', { name: 'Export & import' })).toBeInTheDocument()
  })

  it('is where offline review is explained', async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', email: 'learner@example.com' } },
      error: null,
    })

    render(await SettingsPage())

    expect(screen.getByRole('heading', { name: 'Offline review' })).toBeInTheDocument()
  })
})
