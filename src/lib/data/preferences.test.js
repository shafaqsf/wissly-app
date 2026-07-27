// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import { getPreferences, setDefaultModel } from './preferences.js'

describe('reading preferences', () => {
  it('returns the stored row', async () => {
    const supabase = fakeSupabase({
      user_preferences: {
        data: { user_id: 'u1', default_model: 'anthropic/claude-sonnet-5', updated_at: 't' },
        error: null,
      },
    })

    const preferences = await getPreferences(supabase)

    expect(preferences).toEqual({
      user_id: 'u1',
      default_model: 'anthropic/claude-sonnet-5',
      updated_at: 't',
    })
  })

  it('reads no row as no preference set yet, not as a failure', async () => {
    const supabase = fakeSupabase({ user_preferences: { data: null, error: null } })

    await expect(getPreferences(supabase)).resolves.toEqual({
      user_id: null,
      default_model: null,
      updated_at: null,
    })
  })

  it('raises what the database said rather than returning nothing', async () => {
    const supabase = fakeSupabase({
      user_preferences: { data: null, error: { message: 'permission denied' } },
    })

    await expect(getPreferences(supabase)).rejects.toThrow('permission denied')
  })
})

describe('setting the default model', () => {
  it('stamps the owner and upserts on the one row per learner', async () => {
    const supabase = fakeSupabase({
      user_preferences: {
        data: { user_id: 'u1', default_model: 'deepseek/deepseek-v4-pro', updated_at: 't' },
        error: null,
      },
    })

    const preferences = await setDefaultModel(supabase, {
      userId: 'u1',
      model: 'deepseek/deepseek-v4-pro',
    })

    expect(preferences.default_model).toBe('deepseek/deepseek-v4-pro')

    const [row, options] = argsOf(supabase.query('user_preferences'), 'upsert')
    expect(row).toMatchObject({ user_id: 'u1', default_model: 'deepseek/deepseek-v4-pro' })
    expect(options).toEqual({ onConflict: 'user_id' })
  })

  it('clears the preference back to the environment default when set to null', async () => {
    const supabase = fakeSupabase({
      user_preferences: {
        data: { user_id: 'u1', default_model: null, updated_at: 't' },
        error: null,
      },
    })

    const preferences = await setDefaultModel(supabase, { userId: 'u1', model: null })

    expect(preferences.default_model).toBeNull()
    const [row] = argsOf(supabase.query('user_preferences'), 'upsert')
    expect(row.default_model).toBeNull()
  })

  it('refuses a model id that is not curated, before touching the database', async () => {
    const supabase = fakeSupabase()

    await expect(
      setDefaultModel(supabase, { userId: 'u1', model: 'made-up/model' }),
    ).rejects.toThrow(/not one of the offered models/i)
    expect(supabase.calls).toHaveLength(0)
  })
})
