// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

/* `addMaterial` stopped generating on upload and stopped returning
 * `artefacts`, `skipped` and `failures` with it. The action's `summarise`
 * kept reading all three, so the happy path threw on
 * `artefacts.length` — after the material had already been written. Nothing
 * covered it. These do. */

const {
  addMaterial,
  courseById,
  requireUserId,
  revalidatePath,
  fetchReadableText,
  createOpenRouterClient,
} = vi.hoisted(() => ({
  addMaterial: vi.fn(),
  courseById: vi.fn(),
  requireUserId: vi.fn(async () => 'user-1'),
  revalidatePath: vi.fn(),
  fetchReadableText: vi.fn(),
  createOpenRouterClient: vi.fn(() => ({ chat: vi.fn(), model: 'vision/model' })),
}))

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/material/add-material.js', () => ({ addMaterial }))
vi.mock('@/lib/material/fetch-url.js', () => ({ fetchReadableText }))
vi.mock('@/lib/data/courses.js', () => ({ courseById }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/agent/openrouter.js', () => ({
  createOpenRouterClient,
  openRouterConfigFromEnv: vi.fn(() => ({ apiKey: 'sk-test', model: 'chat/model' })),
}))

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

  it('asks for something to read when neither text, a link nor a file arrived', async () => {
    const state = await addMaterialAction({}, form({ courseId: 'course-1' }))

    expect(state).toEqual({ message: 'Paste some text, paste a link, or choose a file.' })
    expect(addMaterial).not.toHaveBeenCalled()
  })

  it('passes the failure through in the learner’s words', async () => {
    addMaterial.mockRejectedValue(new Error('There was no readable text in that.'))

    const state = await addMaterialAction({}, form({ courseId: 'course-1', text: 'x' }))

    expect(state).toEqual({ message: 'There was no readable text in that.' })
  })
})

describe('a web link', () => {
  it('fetches the page, ingests its readable text and files the address as the origin', async () => {
    fetchReadableText.mockResolvedValue({
      title: 'Refraction',
      text: 'Light bends at a boundary.',
      url: 'https://example.com/refraction',
    })

    await addMaterialAction(
      {},
      form({ courseId: 'course-1', url: 'https://example.com/refraction' }),
    )

    expect(fetchReadableText).toHaveBeenCalledWith('https://example.com/refraction')
    expect(addMaterial).toHaveBeenCalledWith(
      expect.objectContaining({
        material: expect.objectContaining({
          kind: 'url',
          text: 'Light bends at a boundary.',
          origin: 'https://example.com/refraction',
          title: 'Refraction',
        }),
      }),
    )
  })

  it('makes no vision call for a web link', async () => {
    fetchReadableText.mockResolvedValue({ title: '', text: 'Text.', url: 'https://example.com' })

    await addMaterialAction({}, form({ courseId: 'course-1', url: 'https://example.com' }))

    expect(createOpenRouterClient).not.toHaveBeenCalled()
  })

  it('reports a link it could not read, in the fetcher’s own words', async () => {
    fetchReadableText.mockRejectedValue(new Error('Could not reach that address.'))

    const state = await addMaterialAction(
      {},
      form({ courseId: 'course-1', url: 'https://gone.example' }),
    )

    expect(state).toEqual({ message: 'Could not reach that address.' })
    expect(addMaterial).not.toHaveBeenCalled()
  })
})

describe('a file upload', () => {
  function fileNamed(name, type) {
    return new File(['content'], name, { type })
  }

  it('reads a .pptx by its content type', async () => {
    const file = fileNamed(
      'slides.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    )

    await addMaterialAction({}, form({ courseId: 'course-1', file }))

    expect(addMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ material: expect.objectContaining({ kind: 'pptx' }) }),
    )
    expect(createOpenRouterClient).not.toHaveBeenCalled()
  })

  it('falls back to the file extension when the browser sends no content type', async () => {
    const file = fileNamed('slides.pptx', '')

    await addMaterialAction({}, form({ courseId: 'course-1', file }))

    expect(addMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ material: expect.objectContaining({ kind: 'pptx' }) }),
    )
  })

  it('reads a photo and hands it a vision client to transcribe it', async () => {
    const file = fileNamed('notes.jpg', 'image/jpeg')

    await addMaterialAction({}, form({ courseId: 'course-1', file }))

    expect(createOpenRouterClient).toHaveBeenCalled()
    expect(addMaterial).toHaveBeenCalledWith(
      expect.objectContaining({
        material: expect.objectContaining({ kind: 'image', mimeType: 'image/jpeg' }),
        client: expect.anything(),
      }),
    )
  })

  it('refuses a file type wissly does not read yet', async () => {
    const file = fileNamed('notes.docx', 'application/msword')

    const state = await addMaterialAction({}, form({ courseId: 'course-1', file }))

    expect(state.message).toMatch(/PDF|pptx|photo/)
    expect(addMaterial).not.toHaveBeenCalled()
  })

  it('never builds a vision client for a plain PDF', async () => {
    const file = fileNamed('lecture.pdf', 'application/pdf')

    await addMaterialAction({}, form({ courseId: 'course-1', file }))

    expect(createOpenRouterClient).not.toHaveBeenCalled()
    expect(addMaterial).toHaveBeenCalledWith(
      expect.objectContaining({
        material: expect.objectContaining({ kind: 'pdf', explainImages: false }),
      }),
    )
  })

  it('builds a vision client for a PDF once the learner asks to explain its diagrams', async () => {
    const file = fileNamed('lecture.pdf', 'application/pdf')

    await addMaterialAction({}, form({ courseId: 'course-1', file, explainImages: 'on' }))

    expect(createOpenRouterClient).toHaveBeenCalled()
    expect(addMaterial).toHaveBeenCalledWith(
      expect.objectContaining({
        material: expect.objectContaining({ kind: 'pdf', explainImages: true }),
      }),
    )
  })
})
