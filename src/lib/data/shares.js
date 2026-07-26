import { unwrap, unwrapList } from './result.js'

/* Sharing is read-only, by design: a share grants `view`, and that is the
 * only `access_level` `subject_shares` allows (migrations/007). Nothing here
 * needs to say that out loud per call — the schema already refuses anything
 * else.
 *
 * `shareCourseByEmail` is the one write here that is not a plain insert. It
 * has to turn an email address into a user id, and no policy in this schema
 * is allowed to read `auth.users` to do that — so it goes through the
 * `share_subject_by_email` RPC, a `security definer` function that re-checks
 * ownership itself before it writes anything. See the migration for the
 * reasoning; this module only calls it. */

export async function shareCourseByEmail(supabase, { subjectId, email }) {
  const trimmedEmail = String(email ?? '').trim()

  return unwrap(
    await supabase.rpc('share_subject_by_email', {
      target_subject_id: subjectId,
      invitee_email: trimmedEmail,
    }),
    'share the course',
  )
}

/** Who a course has been shared with, as its owner sees it. */
export async function listShares(supabase, { subjectId }) {
  return unwrapList(
    await supabase
      .from('subject_shares')
      .select('id, shared_with_user_id, created_at')
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false }),
    'list who this course is shared with',
  )
}

/** The courses shared with this account, as the recipient sees them. */
export async function listSharedWithMe(supabase) {
  return unwrapList(
    await supabase
      .from('subject_shares')
      .select('id, subject_id, user_id, created_at')
      .order('created_at', { ascending: false }),
    'list courses shared with you',
  )
}

/**
 * End a share. RLS lets either the owner revoke it or the recipient leave it
 * (migrations/007) — this function does not know or care which one is
 * calling; the database is the one place that check has to hold.
 */
export async function revokeShare(supabase, { id }) {
  return unwrap(
    await supabase.from('subject_shares').delete().eq('id', id),
    'remove the share',
  )
}
