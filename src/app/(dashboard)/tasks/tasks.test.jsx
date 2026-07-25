import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dueArtefacts, listArtefacts, listCourses, listSourcesWithSections, notFound, redirect } =
  vi.hoisted(() => ({
    dueArtefacts: vi.fn(async () => []),
    listArtefacts: vi.fn(async () => []),
    listCourses: vi.fn(async () => []),
    listSourcesWithSections: vi.fn(async () => []),
    notFound: vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND')
    }),
    redirect: vi.fn((url) => {
      throw new Error(`NEXT_REDIRECT:${url}`)
    }),
  }))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/data/artefacts.js', () => ({ listArtefacts }))
vi.mock('@/lib/data/courses.js', () => ({ listCourses }))
vi.mock('@/lib/data/review.js', () => ({ dueArtefacts }))
vi.mock('@/lib/data/sources.js', () => ({ listSourcesWithSections }))
vi.mock('next/navigation', () => ({
  notFound,
  redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/tasks/flashcards',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/actions/task', () => ({
  archiveTasksAction: vi.fn(),
  createTaskAction: vi.fn(),
  generateTasksAction: vi.fn(),
  moveTasksAction: vi.fn(),
  rescheduleTasksAction: vi.fn(),
  restoreTasksAction: vi.fn(),
  sectionsWithFormatAction: vi.fn(),
  updateTaskAction: vi.fn(),
}))
vi.mock('@/lib/actions/review', () => ({
  gradeAnswerAction: vi.fn(),
  rateArtefactAction: vi.fn(),
}))

import TaskArchivePage from './archive/page'
import DuePage from './due/page'
import TasksPage from './page'
import TaskTypePage from './[type]/page'

const courses = [
  { id: 'course-1', title: 'Optics' },
  { id: 'course-2', title: 'Algebra' },
]

const flashcard = {
  id: 'task-1',
  format: 'flashcard',
  section_id: 'section-1',
  subject_id: 'course-1',
  section_ordinal: 1,
  anchor: { page: 2 },
  origin: 'agent',
  payload: { front: 'What is an eigenvalue?', back: 'A scale factor.' },
}

function query(searchParams = {}, routeParams = {}) {
  return { searchParams: Promise.resolve(searchParams), params: Promise.resolve(routeParams) }
}

/** Where a call to `redirect` was pointed, or null if it was not called. */
async function destinationOf(promise) {
  try {
    await promise
  } catch (error) {
    if (String(error.message).startsWith('NEXT_REDIRECT:')) {
      return String(error.message).slice('NEXT_REDIRECT:'.length)
    }
    throw error
  }
  return null
}

beforeEach(() => {
  vi.clearAllMocks()
  listCourses.mockResolvedValue(courses)
  listArtefacts.mockResolvedValue([])
  listSourcesWithSections.mockResolvedValue([])
  dueArtefacts.mockResolvedValue([])
})

describe('/tasks', () => {
  it('opens on what is due, because that is what answers "what now"', async () => {
    expect(await destinationOf(TasksPage(query()))).toBe('/tasks/due')
  })

  it('carries the chosen course through to it', async () => {
    expect(await destinationOf(TasksPage(query({ course: 'course-1' })))).toBe(
      '/tasks/due?course=course-1',
    )
  })
})

describe('/tasks/due', () => {
  it('is the daily queue, under the workbench frame', async () => {
    dueArtefacts.mockResolvedValue([flashcard])

    render(await DuePage(query()))

    expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Due/ })).toHaveAttribute('href', '/tasks/due')
    expect(screen.getByText('1 of 1 due')).toBeInTheDocument()
  })

  it('counts what is due beside the entry that leads to it', async () => {
    dueArtefacts.mockResolvedValue([flashcard, { ...flashcard, id: 'task-2' }])

    render(await DuePage(query()))

    expect(screen.getByRole('link', { name: 'Due 2' })).toBeInTheDocument()
  })

  it('scopes the queue to the course the picker names', async () => {
    render(await DuePage(query({ course: 'course-1' })))

    expect(dueArtefacts).toHaveBeenCalledWith({}, { subjectId: 'course-1' })
    expect(screen.getByLabelText('Course')).toHaveValue('course-1')
  })

  it('reads every course when the picker says all of them', async () => {
    render(await DuePage(query()))

    expect(dueArtefacts).toHaveBeenCalledWith({}, { subjectId: undefined })
    expect(screen.getByLabelText('Course')).toHaveValue('')
  })
})

describe('/tasks/[type]', () => {
  it('gives each type its own address and its own surface', async () => {
    listArtefacts.mockResolvedValue([flashcard])

    render(await TaskTypePage(query({}, { type: 'flashcards' })))

    expect(screen.getByRole('heading', { level: 2, name: 'Flashcards' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Write one' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate from material' })).toBeInTheDocument()
  })

  it('shows only this type, however many others the course holds', async () => {
    listArtefacts.mockResolvedValue([
      flashcard,
      { ...flashcard, id: 'task-2', format: 'cloze', payload: { text: 'A ____.', answer: 'x' } },
    ])

    render(await TaskTypePage(query({}, { type: 'cloze' })))

    expect(screen.getByText('x')).toBeInTheDocument()
    expect(screen.queryByText('What is an eigenvalue?')).not.toBeInTheDocument()
  })

  it('counts every type beside its own entry', async () => {
    listArtefacts.mockResolvedValue([flashcard, { ...flashcard, id: 'task-2' }])

    render(await TaskTypePage(query({}, { type: 'flashcards' })))

    expect(screen.getByRole('link', { name: 'Flashcards 2' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cloze 0' })).toBeInTheDocument()
  })

  it('keeps the course when the learner moves to another type', async () => {
    render(await TaskTypePage(query({ course: 'course-1' }, { type: 'flashcards' })))

    expect(screen.getByRole('link', { name: /^Cloze/ })).toHaveAttribute(
      'href',
      '/tasks/cloze?course=course-1',
    )
  })

  it('is not a page for a type that does not exist', async () => {
    await expect(TaskTypePage(query({}, { type: 'summaries' }))).rejects.toThrow('NEXT_NOT_FOUND')
  })
})

describe('/tasks/archive', () => {
  it('reads what was put away rather than what is on the shelf', async () => {
    render(await TaskArchivePage(query()))

    expect(listArtefacts).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ archived: true }),
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Archive' })).toBeInTheDocument()
  })

  it('says so, and says what lands here, when nothing has been archived', async () => {
    render(await TaskArchivePage(query()))

    expect(
      screen.getByText(
        'Nothing archived. What you archive lands here and can be restored, keeping the passage it was written from.',
      ),
    ).toBeInTheDocument()
  })
})
