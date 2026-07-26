// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { argsOf, fakeSupabase } from './fake-supabase.js'
import { listShares, listSharedWithMe, revokeShare, shareCourseByEmail } from './shares.js'

/* `shareCourseByEmail` and the leaderboard both cross into another user's
 * data, so both are RPCs backed by a `security definer` function rather than
 * a plain table query — see migrations/015_collaboration.sql. Everything
 * else here is an ordinary read or delete against `subject_shares`, gated by
 * its own RLS. */

describe('sharing a course by email', () => {
  it('calls the definer function with the subject and the invitee', async () => {
    const supabase = fakeSupabase({
      subject_shares: undefined,
    })
    supabase.rpc = (name, args) => {
      supabase.calls.push({ table: `rpc:${name}`, chain: [{ method: 'rpc', args: [name, args] }] })
      return Promise.resolve({
        data: { id: 'share-1', subject_id: 'course-1', shared_with_user_id: 'user-2' },
        error: null,
      })
    }

    const share = await shareCourseByEmail(supabase, {
      subjectId: 'course-1',
      email: 'friend@example.com',
    })

    expect(share).toEqual({ id: 'share-1', subject_id: 'course-1', shared_with_user_id: 'user-2' })
    expect(supabase.calls[0].chain[0].args).toEqual([
      'share_subject_by_email',
      { target_subject_id: 'course-1', invitee_email: 'friend@example.com' },
    ])
  })

  it('raises what the database said — a friendly message from the function, not a stack trace', async () => {
    const supabase = fakeSupabase()
    supabase.rpc = () =>
      Promise.resolve({ data: null, error: { message: 'No wissly account uses that email.' } })

    await expect(
      shareCourseByEmail(supabase, { subjectId: 'course-1', email: 'nobody@example.com' }),
    ).rejects.toThrow('No wissly account uses that email.')
  })

  it('trims the email before sending it', async () => {
    const supabase = fakeSupabase()
    let sentArgs
    supabase.rpc = (name, args) => {
      sentArgs = args
      return Promise.resolve({ data: { id: 'share-1' }, error: null })
    }

    await shareCourseByEmail(supabase, { subjectId: 'course-1', email: '  friend@example.com  ' })

    expect(sentArgs).toEqual({ target_subject_id: 'course-1', invitee_email: 'friend@example.com' })
  })
})

describe('listing shares as the owner', () => {
  it('lists who a course has been shared with, newest first', async () => {
    const supabase = fakeSupabase({
      subject_shares: {
        data: [
          {
            id: 'sh-1',
            shared_with_user_id: 'user-2',
            invitee_email: 'friend@example.com',
            created_at: '2026-01-02',
          },
        ],
        error: null,
      },
    })

    const shares = await listShares(supabase, { subjectId: 'course-1' })

    expect(shares).toEqual([
      {
        id: 'sh-1',
        shared_with_user_id: 'user-2',
        invitee_email: 'friend@example.com',
        created_at: '2026-01-02',
      },
    ])
    expect(argsOf(supabase.query('subject_shares'), 'eq')).toEqual(['subject_id', 'course-1'])
    expect(argsOf(supabase.query('subject_shares'), 'order')).toEqual([
      'created_at',
      { ascending: false },
    ])
  })

  it('reads no rows as no shares, not as a failure', async () => {
    const supabase = fakeSupabase({ subject_shares: { data: null, error: null } })

    await expect(listShares(supabase, { subjectId: 'course-1' })).resolves.toEqual([])
  })
})

describe('listing courses shared with me', () => {
  it('lists the shares this account has received', async () => {
    const supabase = fakeSupabase({
      subject_shares: {
        data: [{ id: 'sh-1', subject_id: 'course-1', user_id: 'owner-1' }],
        error: null,
      },
    })

    const shares = await listSharedWithMe(supabase)

    expect(shares).toEqual([{ id: 'sh-1', subject_id: 'course-1', user_id: 'owner-1' }])
  })
})

describe('revoking a share', () => {
  it('deletes the share row by id', async () => {
    const supabase = fakeSupabase({ subject_shares: { data: null, error: null } })

    await revokeShare(supabase, { id: 'sh-1' })

    expect(argsOf(supabase.query('subject_shares'), 'delete')).toEqual([])
    expect(argsOf(supabase.query('subject_shares'), 'eq')).toEqual(['id', 'sh-1'])
  })
})
