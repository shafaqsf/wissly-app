// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  candidateConcepts,
  createConceptLinks,
  existingPairs,
  listConcepts,
  requireUserId,
  revalidatePath,
  suggestConceptLinks,
} = vi.hoisted(() => ({
  candidateConcepts: vi.fn(async () => []),
  createConceptLinks: vi.fn(async () => []),
  existingPairs: vi.fn(async () => new Set()),
  listConcepts: vi.fn(async () => []),
  requireUserId: vi.fn(async () => 'user-1'),
  revalidatePath: vi.fn(),
  suggestConceptLinks: vi.fn(async () => []),
}))

const supabase = {}

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => supabase) }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/data/concepts.js', () => ({ candidateConcepts, listConcepts }))
vi.mock('@/lib/data/concept-links.js', () => ({
  createConceptLinks,
  existingPairs,
  pairKey: (a, b) => [a, b].sort().join('::'),
}))
vi.mock('@/lib/agent/concept-links.js', () => ({ suggestConceptLinks }))
vi.mock('@/lib/agent/openrouter.js', () => ({
  createOpenRouterClient: vi.fn(() => ({})),
  openRouterConfigFromEnv: vi.fn(() => ({})),
}))

import { generateConceptLinksAction } from './concept-links.js'

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUserId.mockResolvedValue('user-1')
  listConcepts.mockResolvedValue([{ id: 'c1', term: 'Refraction', definition: 'Light bends.' }])
  candidateConcepts.mockResolvedValue([
    {
      id: 'x1',
      term: "Snell's law",
      definition: 'Angle formula.',
      subjectId: 'sub-2',
      courseTitle: 'Optics',
    },
  ])
  existingPairs.mockResolvedValue(new Set())
  suggestConceptLinks.mockResolvedValue([
    { conceptId: 'c1', relatedConceptId: 'x1', reason: 'Both about bending light.' },
  ])
})

describe('generateConceptLinksAction', () => {
  it('writes the links the agent found, owner stamped', async () => {
    const result = await generateConceptLinksAction({}, form({ subjectId: 'sub-1' }))

    expect(createConceptLinks).toHaveBeenCalledWith(supabase, {
      userId: 'user-1',
      links: [{ conceptId: 'c1', relatedConceptId: 'x1', reason: 'Both about bending light.' }],
    })
    expect(result.done).toBe(true)
  })

  it('says so without a course', async () => {
    const result = await generateConceptLinksAction({}, form({}))

    expect(result.message).toMatch(/course is gone/)
    expect(listConcepts).not.toHaveBeenCalled()
  })

  it('says so when the course has no concepts yet', async () => {
    listConcepts.mockResolvedValue([])

    const result = await generateConceptLinksAction({}, form({ subjectId: 'sub-1' }))

    expect(result.message).toMatch(/Add material/)
    expect(candidateConcepts).not.toHaveBeenCalled()
  })

  it('says so when the library holds nothing else yet', async () => {
    candidateConcepts.mockResolvedValue([])

    const result = await generateConceptLinksAction({}, form({ subjectId: 'sub-1' }))

    expect(result.message).toMatch(/nothing else in your library/)
    expect(suggestConceptLinks).not.toHaveBeenCalled()
  })

  it("excludes this course's own concepts from its candidates", async () => {
    await generateConceptLinksAction({}, form({ subjectId: 'sub-1' }))

    expect(candidateConcepts).toHaveBeenCalledWith(supabase, { excludeIds: ['c1'] })
  })

  it('drops a suggestion that repeats an already-stored pair', async () => {
    existingPairs.mockResolvedValue(new Set(['c1::x1']))

    const result = await generateConceptLinksAction({}, form({ subjectId: 'sub-1' }))

    expect(createConceptLinks).not.toHaveBeenCalled()
    expect(result.message).toMatch(/No new/)
  })

  it("reports the model's own message when it fails", async () => {
    suggestConceptLinks.mockRejectedValue(new Error('OpenRouter is down.'))

    const result = await generateConceptLinksAction({}, form({ subjectId: 'sub-1' }))

    expect(result.message).toBe('OpenRouter is down.')
    expect(createConceptLinks).not.toHaveBeenCalled()
  })
})
