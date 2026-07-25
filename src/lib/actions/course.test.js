// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  archiveArtefact,
  archiveSource,
  createCourse,
  redirect,
  requireUserId,
  restoreArtefact,
  restoreSource,
  revalidatePath,
} = vi.hoisted(() => ({
  archiveArtefact: vi.fn(),
  archiveSource: vi.fn(),
  createCourse: vi.fn(),
  redirect: vi.fn((url) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
  requireUserId: vi.fn(async () => 'user-1'),
  restoreArtefact: vi.fn(),
  restoreSource: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId }))
vi.mock('@/lib/data/courses.js', () => ({ createCourse }))
vi.mock('@/lib/data/sources.js', () => ({ archiveSource, restoreSource }))
vi.mock('@/lib/data/artefacts.js', () => ({ archiveArtefact, restoreArtefact }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({ redirect }))

import {
  archiveReadingAction,
  archiveSourceAction,
  createCourseAction,
  restoreReadingAction,
  restoreSourceAction,
} from './course.js'

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
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
  requireUserId.mockResolvedValue('user-1')
  createCourse.mockResolvedValue({ id: 'course-1', title: 'Optics' })
})

describe('creating a course', () => {
  it('creates it under the signed-in learner', async () => {
    await destinationOf(createCourseAction({}, form({ title: 'Optics' })))

    expect(createCourse).toHaveBeenCalledWith({}, { userId: 'user-1', title: 'Optics' })
  })

  it('opens the empty shelf it just made', async () => {
    const where = await destinationOf(createCourseAction({}, form({ title: 'Optics' })))

    expect(where).toBe('/courses/course-1')
  })

  it('asks for a name rather than creating an untitled course', async () => {
    const state = await createCourseAction({}, form({ title: '   ' }))

    expect(state).toEqual({ message: 'Give the course a name.' })
    expect(createCourse).not.toHaveBeenCalled()
  })

  it('says what went wrong instead of failing silently', async () => {
    createCourse.mockRejectedValue(new Error('permission denied'))

    const state = await createCourseAction({}, form({ title: 'Optics' }))

    expect(state).toEqual({ message: 'permission denied' })
  })
})

describe('archiving and restoring', () => {
  it('archives a source and refreshes its shelf', async () => {
    await archiveSourceAction(form({ id: 'source-1', courseId: 'course-1' }))

    expect(archiveSource).toHaveBeenCalledWith({}, { id: 'source-1' })
    expect(revalidatePath).toHaveBeenCalledWith('/courses/course-1')
  })

  it('restores a source', async () => {
    await restoreSourceAction(form({ id: 'source-1', courseId: 'course-1' }))

    expect(restoreSource).toHaveBeenCalledWith({}, { id: 'source-1' })
  })

  it('archives a piece of reading', async () => {
    await archiveReadingAction(form({ id: 'artefact-1', courseId: 'course-1' }))

    expect(archiveArtefact).toHaveBeenCalledWith({}, { id: 'artefact-1' })
  })

  it('restores a piece of reading', async () => {
    await restoreReadingAction(form({ id: 'artefact-1', courseId: 'course-1' }))

    expect(restoreArtefact).toHaveBeenCalledWith({}, { id: 'artefact-1' })
  })

  it('does nothing at all when no row was named', async () => {
    await archiveSourceAction(form({ courseId: 'course-1' }))

    expect(archiveSource).not.toHaveBeenCalled()
  })
})
