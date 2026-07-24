import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listCourses } = vi.hoisted(() => ({ listCourses: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/data/courses', () => ({ listCourses }))

import CoursesPage from './page'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the courses page', () => {
  it('names every course the learner is carrying', async () => {
    listCourses.mockResolvedValue([
      { id: 'sub-1', title: 'Optics', sources: 2, concepts: 12, settled: 3 },
      { id: 'sub-2', title: 'Algebra', sources: 1, concepts: 4, settled: 4 },
    ])

    render(await CoursesPage())

    expect(screen.getByRole('heading', { level: 1, name: 'Courses' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Optics/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Algebra/ })).toBeInTheDocument()
  })

  it('sends a course through to its own grain field on the progress page', async () => {
    listCourses.mockResolvedValue([
      { id: 'sub-1', title: 'Optics', sources: 2, concepts: 12, settled: 3 },
    ])

    render(await CoursesPage())

    expect(screen.getByRole('link', { name: /Optics/ })).toHaveAttribute(
      'href',
      '/progress?subject=sub-1',
    )
  })

  it('says how much material and how much of it has settled', async () => {
    listCourses.mockResolvedValue([
      { id: 'sub-1', title: 'Optics', sources: 2, concepts: 12, settled: 3 },
    ])

    render(await CoursesPage())

    expect(screen.getByText('2 sources · 3 of 12 concepts settled')).toBeInTheDocument()
  })

  it('counts one of a thing in the singular', async () => {
    listCourses.mockResolvedValue([
      { id: 'sub-1', title: 'Optics', sources: 1, concepts: 1, settled: 0 },
    ])

    render(await CoursesPage())

    expect(screen.getByText('1 source · 0 of 1 concept settled')).toBeInTheDocument()
  })

  it('invites the learner to add material when there is no course yet', async () => {
    listCourses.mockResolvedValue([])

    render(await CoursesPage())

    expect(screen.getByRole('link', { name: 'Add your first material' })).toHaveAttribute(
      'href',
      '/library',
    )
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
