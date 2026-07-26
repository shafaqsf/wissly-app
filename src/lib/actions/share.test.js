// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUserId, revokeShare, setSubjectPublic, shareCourseByEmail, revalidatePath } =
  vi.hoisted(() => ({
    requireUserId: vi.fn(async () => 'user-1'),
    revokeShare: vi.fn(),
    setSubjectPublic: vi.fn(),
    shareCourseByEmail: vi.fn(),
    revalidatePath: vi.fn(),
  }))

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId }))
vi.mock('@/lib/data/shares.js', () => ({ revokeShare, shareCourseByEmail }))
vi.mock('@/lib/data/subjects.js', () => ({ setSubjectPublic }))
vi.mock('next/cache', () => ({ revalidatePath }))

import { revokeShareAction, setCourseVisibilityAction, shareCourseAction } from './share.js'

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUserId.mockResolvedValue('user-1')
})

describe('sharing a course', () => {
  it('shares it with the email given', async () => {
    shareCourseByEmail.mockResolvedValue({ id: 'share-1' })

    await shareCourseAction({}, form({ courseId: 'course-1', email: 'friend@example.com' }))

    expect(shareCourseByEmail).toHaveBeenCalledWith(
      {},
      { subjectId: 'course-1', email: 'friend@example.com' },
    )
    expect(revalidatePath).toHaveBeenCalledWith('/courses/course-1')
  })

  it('asks for an email rather than sharing with nobody', async () => {
    const state = await shareCourseAction({}, form({ courseId: 'course-1', email: '  ' }))

    expect(state.message).toMatch(/email/i)
    expect(shareCourseByEmail).not.toHaveBeenCalled()
  })

  it('says what the database said when the invite fails', async () => {
    shareCourseByEmail.mockRejectedValue(new Error('No wissly account uses that email.'))

    const state = await shareCourseAction({}, form({ courseId: 'course-1', email: 'nobody@x.com' }))

    expect(state).toEqual({ message: 'No wissly account uses that email.' })
  })

  it('does nothing without a course to share', async () => {
    const state = await shareCourseAction({}, form({ email: 'friend@example.com' }))

    expect(state.message).toBeTruthy()
    expect(shareCourseByEmail).not.toHaveBeenCalled()
  })
})

describe('revoking a share', () => {
  it('removes it and refreshes the course page', async () => {
    await revokeShareAction(form({ id: 'share-1', courseId: 'course-1' }))

    expect(revokeShare).toHaveBeenCalledWith({}, { id: 'share-1' })
    expect(revalidatePath).toHaveBeenCalledWith('/courses/course-1')
  })

  it('does nothing when no share was named', async () => {
    await revokeShareAction(form({ courseId: 'course-1' }))

    expect(revokeShare).not.toHaveBeenCalled()
  })
})

describe('changing whether a course is public', () => {
  it('turns a course public', async () => {
    await setCourseVisibilityAction(form({ courseId: 'course-1', isPublic: 'true' }))

    expect(setSubjectPublic).toHaveBeenCalledWith({}, { id: 'course-1', isPublic: true })
    expect(revalidatePath).toHaveBeenCalledWith('/courses/course-1')
    expect(revalidatePath).toHaveBeenCalledWith('/library')
  })

  it('turns a course private', async () => {
    await setCourseVisibilityAction(form({ courseId: 'course-1', isPublic: 'false' }))

    expect(setSubjectPublic).toHaveBeenCalledWith({}, { id: 'course-1', isPublic: false })
  })
})
