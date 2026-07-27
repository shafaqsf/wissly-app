// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { importCourse, redirect, requireUserId, revalidatePath } = vi.hoisted(() => ({
  importCourse: vi.fn(),
  redirect: vi.fn((url) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
  requireUserId: vi.fn(async () => 'user-2'),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId }))
vi.mock('@/lib/data/library.js', () => ({ importCourse }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({ redirect }))

import { importCourseAction } from './library.js'

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

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
  requireUserId.mockResolvedValue('user-2')
})

describe('importing a public course', () => {
  it('imports it under the signed-in learner and opens the copy', async () => {
    importCourse.mockResolvedValue({ id: 'new-1', title: 'Optics' })

    const where = await destinationOf(importCourseAction({}, form({ courseId: 'pub-1' })))

    expect(importCourse).toHaveBeenCalledWith({}, { subjectId: 'pub-1', userId: 'user-2' })
    expect(where).toBe('/courses/new-1')
  })

  it('requires signing in first', async () => {
    requireUserId.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT:/sign-in')
    })

    await expect(importCourseAction({}, form({ courseId: 'pub-1' }))).rejects.toThrow(
      'NEXT_REDIRECT:/sign-in',
    )
  })

  it('says what went wrong instead of failing silently', async () => {
    importCourse.mockRejectedValue(new Error('That course is not public, or no longer exists.'))

    const state = await importCourseAction({}, form({ courseId: 'pub-1' }))

    expect(state).toEqual({ message: 'That course is not public, or no longer exists.' })
  })

  it('does nothing without a course to import', async () => {
    const state = await importCourseAction({}, form({}))

    expect(state.message).toBeTruthy()
    expect(importCourse).not.toHaveBeenCalled()
  })
})
