import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  courseById,
  dailyGoalFor,
  examPlanFor,
  listArtefacts,
  listConceptMastery,
  listSourcesWithSections,
  notFound,
} = vi.hoisted(() => ({
  courseById: vi.fn(),
  dailyGoalFor: vi.fn(),
  examPlanFor: vi.fn(),
  listArtefacts: vi.fn(),
  listConceptMastery: vi.fn(),
  listSourcesWithSections: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/data/courses', () => ({ courseById }))
vi.mock('@/lib/data/sources', () => ({ listSourcesWithSections }))
vi.mock('@/lib/data/concepts', () => ({ listConceptMastery }))
vi.mock('@/lib/data/artefacts', () => ({ listArtefacts }))
vi.mock('@/lib/data/daily-goal', () => ({ dailyGoalFor }))
vi.mock('@/lib/data/exam-plan', () => ({ examPlanFor }))
vi.mock('next/navigation', () => ({ notFound }))
vi.mock('@/lib/actions/material', () => ({ addMaterialAction: vi.fn() }))
vi.mock('@/lib/actions/course', () => ({
  archiveReadingAction: vi.fn(),
  archiveSourceAction: vi.fn(),
  restoreReadingAction: vi.fn(),
  restoreSourceAction: vi.fn(),
  setExamDateAction: vi.fn(),
}))

import CoursePage from './page'

const course = { id: 'course-1', title: 'Optics', sources: 1, concepts: 3, settled: 1 }

const source = {
  id: 'source-1',
  title: 'Lecture 3',
  kind: 'pdf',
  sections: [{ id: 'sec-1', ordinal: 1, content: 'Light bends.', anchor: { page: 12 } }],
}

const reading = {
  id: 'a1',
  subject_id: 'course-1',
  section_id: 'sec-1',
  format: 'glossary',
  payload: { term: 'Refraction', definition: 'Light bending at a boundary.' },
  section_ordinal: 1,
  anchor: { page: 12 },
  passage: 'Light bends at a boundary.',
}

/** Sensible defaults: one source, three concepts, one glossary entry, no archive. */
function stock() {
  courseById.mockResolvedValue(course)
  listSourcesWithSections.mockImplementation(async (_supabase, { archived } = {}) =>
    archived ? [] : [source],
  )
  listConceptMastery.mockResolvedValue([
    { id: 'c1', subjectId: 'course-1', name: 'Boundaries', mastery: 0 },
    { id: 'c2', subjectId: 'course-1', name: 'Snell', mastery: 0.5 },
    { id: 'c3', subjectId: 'course-1', name: 'Dispersion', mastery: 0.95 },
  ])
  listArtefacts.mockImplementation(async (_supabase, { archived, formats } = {}) => {
    if (archived) return []
    if (formats?.includes('flashcard')) {
      return Array.from({ length: 34 }, (_, index) => ({ id: `t${index}`, format: 'flashcard' }))
    }
    return [reading]
  })
  dailyGoalFor.mockResolvedValue({
    subjectId: 'course-1',
    subjectTitle: 'Optics',
    examDate: null,
    target: 0,
    remaining: 0,
    horizonDays: 7,
  })
  examPlanFor.mockResolvedValue(null)
}

const page = (searchParams = {}) =>
  CoursePage({
    params: Promise.resolve({ id: 'course-1' }),
    searchParams: Promise.resolve(searchParams),
  })

beforeEach(() => {
  vi.clearAllMocks()
  stock()
})

describe('the course shelf', () => {
  it('is titled with the course', async () => {
    render(await page())

    expect(screen.getByRole('heading', { level: 1, name: 'Optics' })).toBeInTheDocument()
  })

  it('is a 404 when there is no such course', async () => {
    courseById.mockResolvedValue(null)

    await expect(page()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('reads only this course’s material', async () => {
    await page()

    expect(listSourcesWithSections).toHaveBeenCalledWith({}, { subjectId: 'course-1' })
    expect(listConceptMastery).toHaveBeenCalledWith({}, { subjectId: 'course-1' })
  })

  /* The form moved off `/library`, and with it the subject picker: the course
     is the page. */
  it('takes material here, without asking which course it belongs to', async () => {
    render(await page())

    expect(screen.getByRole('region', { name: 'Add material' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add material' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Subject')).toBeNull()
  })

  it('shows the sources, expandable into their sections', async () => {
    render(await page())

    expect(screen.getByRole('region', { name: 'Sources' })).toBeInTheDocument()
    expect(screen.getByText('Lecture 3')).toBeInTheDocument()
    expect(screen.getByText('page 12')).toBeInTheDocument()
  })

  it('shows what the material covers, with mastery as grain', async () => {
    const { container } = render(await page())

    expect(screen.getByRole('region', { name: 'Concepts' })).toBeInTheDocument()
    expect(container.querySelectorAll('.grain-mark')).toHaveLength(3)
  })

  it('shows the reading beside the material it came from', async () => {
    render(await page())

    expect(screen.getByRole('region', { name: 'Reading' })).toBeInTheDocument()
    expect(screen.getByText('Refraction')).toBeInTheDocument()
  })

  /* A line, not a copy. The task surfaces are not rebuilt here. */
  it('links to this course’s tasks in one line and rebuilds nothing', async () => {
    render(await page())

    const link = screen.getByRole('link', { name: /34 tasks/ })
    expect(link).toHaveAttribute('href', '/tasks?course=course-1')
    expect(screen.queryByRole('region', { name: 'Flashcards' })).toBeNull()
  })

  it('says the course has no tasks yet rather than printing a zero on its own', async () => {
    listArtefacts.mockImplementation(async ({ archived } = {}) => [])

    render(await page())

    expect(screen.getByRole('link', { name: /No tasks yet/ })).toHaveAttribute(
      'href',
      '/tasks?course=course-1',
    )
  })

  /* Analytics' gap report links here as `/courses/[id]?source=<id>`. The link
     has to land on the source itself, open, and it has to survive the source
     having been archived since the link was made. */
  describe('arriving from a link that names a source', () => {
    it('opens the source the link names', async () => {
      const { container } = render(await page({ source: 'source-1' }))

      expect(container.querySelector('#source-source-1').open).toBe(true)
    })

    it('leaves every source closed when no source was named', async () => {
      const { container } = render(await page())

      for (const details of container.querySelectorAll('details')) {
        expect(details.open).toBe(false)
      }
    })

    it('says so when the link names a source that has since been archived', async () => {
      listSourcesWithSections.mockImplementation(async (_supabase, { archived } = {}) =>
        archived ? [{ id: 'source-9', title: 'Old handout', kind: 'pdf', sections: [] }] : [source],
      )

      render(await page({ source: 'source-9' }))

      expect(
        screen.getByText('Old handout is archived. Restore it below to read it again.'),
      ).toBeInTheDocument()
    })

    it('says nothing at all when the link names a source that is not here', async () => {
      render(await page({ source: 'source-nowhere' }))

      expect(screen.queryByText(/is archived\./)).toBeNull()
    })
  })

  it('carries an archive of this course, with a way back', async () => {
    listSourcesWithSections.mockImplementation(async (_supabase, { archived } = {}) =>
      archived ? [{ id: 'source-9', title: 'Old handout', kind: 'pdf', sections: [] }] : [],
    )

    render(await page())

    expect(screen.getByRole('region', { name: 'Archive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore Old handout' })).toBeInTheDocument()
  })

  it('lets the learner take their reading out as Markdown', async () => {
    render(await page())

    expect(screen.getByRole('button', { name: 'Export reading' })).toBeInTheDocument()
  })

  it('shows the pace panel, reading only this course’s goal', async () => {
    render(await page())

    expect(screen.getByRole('region', { name: 'Exam' })).toBeInTheDocument()
    expect(dailyGoalFor).toHaveBeenCalledWith({}, { subjectId: 'course-1' })
  })

  it('only asks for a compressed plan once an exam date exists', async () => {
    render(await page())

    expect(examPlanFor).not.toHaveBeenCalled()
  })

  it('asks for the compressed plan once an exam date is set', async () => {
    dailyGoalFor.mockResolvedValue({
      subjectId: 'course-1',
      subjectTitle: 'Optics',
      examDate: '2026-08-10',
      target: 2,
      remaining: 1,
      horizonDays: 15,
    })
    examPlanFor.mockResolvedValue({
      subjectId: 'course-1',
      subjectTitle: 'Optics',
      examDate: '2026-08-10',
      days: [{ date: '2026-07-26', count: 2, artefactIds: ['a1', 'a2'] }],
    })

    render(await page())

    expect(examPlanFor).toHaveBeenCalledWith({}, { subjectId: 'course-1' })
    expect(screen.getByText('2 reviews')).toBeInTheDocument()
  })

  /* Nothing is generated on upload, so a new course is empty — and an empty
     state that only reports emptiness wastes the one screen a learner sees. */
  it('says what the next step is when the shelf is empty', async () => {
    listSourcesWithSections.mockResolvedValue([])
    listConceptMastery.mockResolvedValue([])
    listArtefacts.mockResolvedValue([])

    render(await page())

    expect(
      screen.getByText(/Add your first material above/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Concepts appear as soon as material is read/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Summaries and glossary entries you generate land here/),
    ).toBeInTheDocument()

    /* task item 7 in v0.15: the material shelf's empty state carries an
       illustration, not only a sentence. */
    expect(document.querySelector('svg[data-empty-illustration]')).toBeInTheDocument()
  })

  /* task item 6 in v0.15: a course wears the same tag on its own header that
     it wears on the shelf in /courses, so the two never disagree. */
  it('wears its own accent tag beside the "Course" label', async () => {
    const { container } = render(await page())

    const dot = container.querySelector('header span[style*="background-color"]')
    expect(dot).toBeInTheDocument()
    // jsdom canonicalises an inline colour to rgb() when it serialises the
    // style attribute back out, whatever notation courseAccent wrote it in.
    expect(dot.getAttribute('style')).toMatch(/rgb\(/)
  })
})
