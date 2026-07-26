// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server.js', () => ({ createClient: async () => ({ learner: true }) }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId: async () => 'u1' }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/data/export.js', () => ({
  allDataBundle: vi.fn(async () => ({ exported_at: 't', courses: [{ subject: { title: 'All' } }] })),
  courseBundle: vi.fn(async () => ({ exported_at: 't', courses: [{ subject: { title: 'Optics' } }] })),
}))

vi.mock('@/lib/import/json.js', () => ({
  importBundle: vi.fn(async () => ({ courses: 1, sources: 0, sections: 0, concepts: 0, artefacts: 0, reviews: 0 })),
}))

const { allDataBundle, courseBundle } = await import('@/lib/data/export.js')
const { importBundle } = await import('@/lib/import/json.js')
const { exportDataAction, importDataAction } = await import('./export.js')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('exportDataAction', () => {
  it('gathers everything when no course is named', async () => {
    const result = await exportDataAction({})

    expect(allDataBundle).toHaveBeenCalled()
    expect(courseBundle).not.toHaveBeenCalled()
    expect(result.bundle.courses[0].subject.title).toBe('All')
  })

  it('gathers one course when it is named', async () => {
    const result = await exportDataAction({ courseId: 's1' })

    expect(courseBundle).toHaveBeenCalledWith(expect.anything(), { subjectId: 's1' })
    expect(result.bundle.courses[0].subject.title).toBe('Optics')
  })

  it('reports when the named course is gone', async () => {
    courseBundle.mockResolvedValueOnce(null)

    const result = await exportDataAction({ courseId: 'gone' })

    expect(result.error).toMatch(/no longer there/i)
  })
})

describe('importDataAction', () => {
  it('imports the bundle as the signed-in learner', async () => {
    const bundle = { courses: [] }

    const result = await importDataAction({ bundle })

    expect(importBundle.mock.calls[0][1]).toMatchObject({ userId: 'u1', bundle })
    expect(result.summary.courses).toBe(1)
  })

  it('reports what the importer refused, rather than throwing', async () => {
    importBundle.mockRejectedValueOnce(new Error('That file is not a wissly export.'))

    const result = await importDataAction({ bundle: {} })

    expect(result.error).toMatch(/not a wissly export/i)
  })
})
