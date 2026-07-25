// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

/* `addMaterial` stopped generating on upload and stopped returning
 * `artefacts`, `skipped` and `failures` with it. The action's `summarise`
 * kept reading all three, so the happy path threw on
 * `artefacts.length` — after the material had already been written. Nothing
 * covered it. These do. */

const { addMaterial, courseById, requireUserId, revalidatePath } = vi.hoisted(() => ({
  addMaterial: vi.fn(),
  courseById: vi.fn(),
  requireUserId: vi.fn(async () => 'user-1'),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/material/add-material.js', () => ({ addMaterial }))
vi.mock('@/lib/data/courses.js', () => ({ courseById }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId }))
vi.mock('next/cache', () => ({ revalidatePath }))

import { addMaterialAction } from './material.js'

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

const course = { id: 'course-1', title: 'Optics', sources: 0, concepts: 0, settled: 0 }

beforeEach(() => {
  vi.clearAllMocks()
  requireUserId.mockResolvedValue('user-1')
  courseById.mockResolvedValue(course)
  addMaterial.mockResolvedValue({
    subject: { id: 'course-1', title: 'Optics' },
    source: { id: 'source-1', title: 'Lecture 3' },
    sections: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
    concepts: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
  })
})

describe('adding material to a course', () => {
  it('reports what was stored, from what addMaterial actually returns', async () => {
    const state = await addMaterialAction({}, form({ courseId: 'course-1', text: 'Light bends.' }))

    expect(state).toEqual({
      message: 'Added Lecture 3: 3 sections, 3 concepts. Nothing was generated — write or generate tasks when you are ready.',
      done: true,
    })
  })

  it('counts one of a thing in the singular', async () => {
    addMaterial.mockResolvedValue({
      subject: course,
      source: { id: 'source-1', title: 'A note' },
      sections: [{ id: 's1' }],
      concepts: [{ id: 'c1' }],
    })

    const state = await addMaterialAction({}, form({ courseId: 'course-1', text: 'Light bends.' }))

    expect(state.message).toContain('Added A note: 1 section, 1 concept.')
  })

  it('takes the course from the page rather than asking the learner to name it', async () => {
    await addMaterialAction({}, form({ courseId: 'course-1', text: 'Light bends.' }))

    expect(addMaterial).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        material: expect.objectContaining({ subject: 'Optics', kind: 'text', text: 'Light bends.' }),
      }),
    )
  })

  it('makes no model call — no OpenRouter client is handed over', async () => {
    await addMaterialAction({}, form({ courseId: 'course-1', text: 'Light bends.' }))

    expect(addMaterial.mock.calls[0][0].client).toBeUndefined()
  })

  it('refreshes the course it landed on', async () => {
    await addMaterialAction({}, form({ courseId: 'course-1', text: 'Light bends.' }))

    expect(revalidatePath).toHaveBeenCalledWith('/courses/course-1')
    expect(revalidatePath).toHaveBeenCalledWith('/courses')
  })

  it('says which course is missing rather than writing material nowhere', async () => {
    courseById.mockResolvedValue(null)

    const state = await addMaterialAction({}, form({ courseId: 'gone', text: 'Light bends.' }))

    expect(state).toEqual({ message: 'That course is gone. Open a course and add the material there.' })
    expect(addMaterial).not.toHaveBeenCalled()
  })

  it('asks for something to read when neither text nor file arrived', async () => {
    const state = await addMaterialAction({}, form({ courseId: 'course-1' }))

    expect(state).toEqual({ message: 'Paste some text or choose a PDF.' })
    expect(addMaterial).not.toHaveBeenCalled()
  })

  it('passes the failure through in the learner’s words', async () => {
    addMaterial.mockRejectedValue(new Error('There was no readable text in that.'))

    const state = await addMaterialAction({}, form({ courseId: 'course-1', text: 'x' }))

    expect(state).toEqual({ message: 'There was no readable text in that.' })
  })
})
