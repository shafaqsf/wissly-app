import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listPublicCourses, currentUserId } = vi.hoisted(() => ({
  listPublicCourses: vi.fn(),
  currentUserId: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/data/library', () => ({ listPublicCourses }))
vi.mock('@/lib/auth/user', () => ({ currentUserId }))
vi.mock('@/lib/actions/library', () => ({ importCourseAction: vi.fn() }))

import LibraryPage from './page'

beforeEach(() => {
  vi.clearAllMocks()
  currentUserId.mockResolvedValue('user-1')
})

describe('the public library page', () => {
  it('names every course anyone has published', async () => {
    listPublicCourses.mockResolvedValue([
      { id: 'sub-1', title: 'Optics', user_id: 'user-2', created_at: '2026-07-01T00:00:00Z' },
      { id: 'sub-2', title: 'Algebra', user_id: 'user-3', created_at: '2026-07-02T00:00:00Z' },
    ])

    render(await LibraryPage())

    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument()
    expect(screen.getByText('Optics')).toBeInTheDocument()
    expect(screen.getByText('Algebra')).toBeInTheDocument()
  })

  it('offers to import each course', async () => {
    listPublicCourses.mockResolvedValue([
      { id: 'sub-1', title: 'Optics', user_id: 'user-2', created_at: '2026-07-01T00:00:00Z' },
    ])

    render(await LibraryPage())

    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument()
  })

  it('says plainly when nobody has published anything yet', async () => {
    listPublicCourses.mockResolvedValue([])

    render(await LibraryPage())

    expect(screen.getByText(/nobody has published a course/i)).toBeInTheDocument()
  })

  it('invites a signed-out visitor to sign in before it mentions importing', async () => {
    currentUserId.mockResolvedValue(null)
    listPublicCourses.mockResolvedValue([
      { id: 'sub-1', title: 'Optics', user_id: 'user-2', created_at: '2026-07-01T00:00:00Z' },
    ])

    render(await LibraryPage())

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/sign-in')
  })
})
