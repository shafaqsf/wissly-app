// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { fakeSupabase } from './fake-supabase.js'
import { subjectLeaderboard } from './leaderboard.js'

/* The leaderboard reads across users, which no ordinary table policy in this
 * schema allows — it goes through `subject_leaderboard`, a `security
 * definer` RPC that only ever returns a count per member and only when the
 * caller is themselves a member. See migrations/007_collaboration.sql. */

describe('the leaderboard', () => {
  it('asks the definer function for one subject and ranks what it returns', async () => {
    const supabase = fakeSupabase()
    let sentArgs
    supabase.rpc = (name, args) => {
      sentArgs = { name, args }
      return Promise.resolve({
        data: [
          { member_id: 'user-2', reviews_this_week: 9 },
          { member_id: 'user-1', reviews_this_week: 3 },
        ],
        error: null,
      })
    }

    const rows = await subjectLeaderboard(supabase, { subjectId: 'course-1' })

    expect(sentArgs).toEqual({
      name: 'subject_leaderboard',
      args: { target_subject_id: 'course-1' },
    })
    expect(rows).toEqual([
      { memberId: 'user-2', reviewsThisWeek: 9, rank: 1 },
      { memberId: 'user-1', reviewsThisWeek: 3, rank: 2 },
    ])
  })

  it('is empty for a caller who is not a member — the function answers nothing, not an error', async () => {
    const supabase = fakeSupabase()
    supabase.rpc = () => Promise.resolve({ data: [], error: null })

    await expect(subjectLeaderboard(supabase, { subjectId: 'course-1' })).resolves.toEqual([])
  })

  it('raises what the database said rather than returning nothing', async () => {
    const supabase = fakeSupabase()
    supabase.rpc = () => Promise.resolve({ data: null, error: { message: 'permission denied' } })

    await expect(subjectLeaderboard(supabase, { subjectId: 'course-1' })).rejects.toThrow(
      'permission denied',
    )
  })

  it('ranks ties together rather than spreading them across ranks', async () => {
    const supabase = fakeSupabase()
    supabase.rpc = () =>
      Promise.resolve({
        data: [
          { member_id: 'user-1', reviews_this_week: 5 },
          { member_id: 'user-2', reviews_this_week: 5 },
          { member_id: 'user-3', reviews_this_week: 1 },
        ],
        error: null,
      })

    const rows = await subjectLeaderboard(supabase, { subjectId: 'course-1' })

    expect(rows.map((row) => row.rank)).toEqual([1, 1, 3])
  })
})
