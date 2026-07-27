// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from '@/lib/data/fake-supabase.js'

import { ensureReviewReminder } from './ensure-review-reminder.js'

const NOW = new Date('2026-07-26T09:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

describe('checking a learner in against their own queue', () => {
  it('writes nothing when nothing is due', async () => {
    const supabase = fakeSupabase({
      artefact_schedule: { data: [], error: null },
      notifications: { data: null, error: null },
    })

    const result = await ensureReviewReminder(supabase, { userId: 'user-1', now: NOW })

    expect(result).toBeNull()
    expect(supabase.queries('notifications').some((call) => call.chain.some((s) => s.method === 'insert'))).toBe(
      false,
    )
  })

  it('inserts a notification once recall has decayed past the threshold', async () => {
    const lastReviewedAt = new Date(NOW.getTime() - 20 * DAY_MS).toISOString()
    const supabase = fakeSupabase({
      artefact_schedule: {
        data: [{ artefact_id: 'a1', stability: '5', due_at: lastReviewedAt, last_reviewed_at: lastReviewedAt }],
        error: null,
      },
      notifications: [{ data: null, error: null }, { data: { id: 'n1' }, error: null }],
    })

    const result = await ensureReviewReminder(supabase, { userId: 'user-1', now: NOW })

    expect(result).toMatchObject({ id: 'n1' })
    const insertCall = supabase
      .queries('notifications')
      .find((call) => call.chain.some((s) => s.method === 'insert'))
    const [row] = argsOf(insertCall, 'insert')
    expect(row).toMatchObject({ user_id: 'user-1', kind: 'review_due' })
  })

  it('reads the last review_due notification before deciding, so it does not repeat itself', async () => {
    const supabase = fakeSupabase({
      artefact_schedule: { data: [], error: null },
      notifications: { data: null, error: null },
    })

    await ensureReviewReminder(supabase, { userId: 'user-1', now: NOW })

    const call = supabase.query('notifications')
    expect(argsOf(call, 'eq')).toEqual(['kind', 'review_due'])
  })
})
