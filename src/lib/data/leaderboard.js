import { unwrapList } from './result.js'

/* Ranking members of a shared course means reading how many reviews someone
 * else logged, and `reviews` RLS is never widened for it (migrations/007) —
 * a learner's review history is not course material. `subject_leaderboard`
 * is a `security definer` function instead: it returns a count per member,
 * never a row, and only for people who already share the course with the
 * caller. A caller who is not a member gets an empty list back, not an
 * error, so this module never has to draw that distinction either.
 *
 * The function orders by count already; ranking ties together (1, 1, 3, not
 * 1, 2, 3) is the one piece of shaping done here rather than in SQL, because
 * it is a display concern and the function's job stops at the numbers. */

export async function subjectLeaderboard(supabase, { subjectId }) {
  const rows = unwrapList(
    await supabase.rpc('subject_leaderboard', { target_subject_id: subjectId }),
    'load the leaderboard',
  )

  let rank = 0
  let previousCount = null

  return rows.map((row, index) => {
    if (row.reviews_this_week !== previousCount) {
      rank = index + 1
      previousCount = row.reviews_this_week
    }

    return { memberId: row.member_id, reviewsThisWeek: row.reviews_this_week, rank }
  })
}
