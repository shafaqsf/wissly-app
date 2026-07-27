// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server.js', () => ({ createClient: async () => ({ learner: true }) }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId: async () => 'u1' }))

vi.mock('@/lib/data/preferences.js', () => ({
  setDefaultModel: vi.fn(async (_supabase, { model }) => ({
    user_id: 'u1',
    default_model: model,
    updated_at: 't',
  })),
}))

const { setDefaultModel } = await import('@/lib/data/preferences.js')
const { revalidatePath } = await import('next/cache')
const { updateDefaultModelAction } = await import('./settings.js')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateDefaultModelAction', () => {
  it('stores the chosen model as the learner', async () => {
    const result = await updateDefaultModelAction({ model: 'anthropic/claude-sonnet-5' })

    expect(setDefaultModel.mock.calls[0][1]).toMatchObject({
      userId: 'u1',
      model: 'anthropic/claude-sonnet-5',
    })
    expect(result.preferences.default_model).toBe('anthropic/claude-sonnet-5')
  })

  it('revalidates settings, so the page reflects the new choice', async () => {
    await updateDefaultModelAction({ model: 'anthropic/claude-sonnet-5' })

    expect(revalidatePath).toHaveBeenCalledWith('/settings')
  })

  it('clears the preference back to the environment default with an empty choice', async () => {
    const result = await updateDefaultModelAction({ model: '' })

    expect(setDefaultModel.mock.calls[0][1].model).toBeNull()
    expect(result.preferences.default_model).toBeNull()
  })

  it('reports what the database refused, rather than throwing', async () => {
    setDefaultModel.mockRejectedValueOnce(new Error('"made-up/model" is not one of the offered models.'))

    const result = await updateDefaultModelAction({ model: 'made-up/model' })

    expect(result.error).toMatch(/not one of the offered models/i)
  })
})
