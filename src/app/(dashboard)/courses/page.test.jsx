import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listCourses } = vi.hoisted(() => ({ listCourses: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/data/courses', () => ({ listCourses }))
vi.mock('@/lib/actions/course', () => ({ createCourseAction: vi.fn() }))

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

  it('sends a course through to its own shelf', async () => {
    listCourses.mockResolvedValue([
      { id: 'sub-1', title: 'Optics', sources: 2, concepts: 12, settled: 3 },
    ])

    render(await CoursesPage())

    expect(screen.getByRole('link', { name: /Optics/ })).toHaveAttribute(
      'href',
      '/courses/sub-1',
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

  /* Creating a course used to be impossible: a course appeared as a side
     effect of adding material and could not be started empty. */
  it('lets the learner start a course by naming one', async () => {
    listCourses.mockResolvedValue([])

    render(await CoursesPage())

    expect(screen.getByLabelText('Name the course')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create course' })).toBeInTheDocument()
  })

  it('offers the same creation form when there are already courses', async () => {
    listCourses.mockResolvedValue([
      { id: 'sub-1', title: 'Optics', sources: 1, concepts: 1, settled: 0 },
    ])

    render(await CoursesPage())

    expect(screen.getByRole('button', { name: 'Create course' })).toBeInTheDocument()
  })

  it('says what to do next when there is no course yet', async () => {
    listCourses.mockResolvedValue([])

    render(await CoursesPage())

    expect(screen.getByText(/Name your first course/)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  /* /library named a different screen before v0.23.0 (the reading library
     that dissolved into the course page in v0.14.0). It now names the public
     course library, and this is its one discoverable entrance — see
     src/app/(dashboard)/library/page.jsx. */
  it('opens onto the public library, not the dissolved one', async () => {
    listCourses.mockResolvedValue([])

    render(await CoursesPage())

    expect(screen.getByRole('link', { name: /public library/i })).toHaveAttribute(
      'href',
      '/library',
    )
  })
})
