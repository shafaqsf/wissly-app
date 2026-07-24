import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getClaims, redirect } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  redirect: vi.fn((url) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('@/lib/supabase/server.js', () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}))
// The shell reads the current path to mark its nav; only `redirect` is
// under test here.
vi.mock('next/navigation', () => ({ redirect, usePathname: () => '/dashboard' }))
vi.mock('@/lib/auth/actions.js', () => ({ signOut: vi.fn() }))

import DashboardLayout from './layout'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the dashboard frame', () => {
  it('turns a signed-out visitor away itself, not only in the proxy', async () => {
    getClaims.mockResolvedValue({ data: null, error: null })

    await expect(DashboardLayout({ children: null })).rejects.toThrow(
      'NEXT_REDIRECT:/sign-in',
    )
  })

  it('shows the learner their page and a way out', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null })

    render(await DashboardLayout({ children: <p>Your subjects</p> }))

    expect(screen.getByText('Your subjects')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})
