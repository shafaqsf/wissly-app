import { unwrap, unwrapList } from './result.js'

/* Where a personalised FSRS weight vector lives, and what it is fitted from.
 *
 * `fsrs_weights` holds at most one row per learner — its primary key is
 * `user_id` — so every read here trusts the primary key and row level
 * security to scope it rather than adding an `.eq('user_id', ...)` a
 * stranger's row could never satisfy anyway. `weightsFor` returning `null`
 * is not an absence of data worth flagging: it means "this learner has never
 * fitted, schedule on the published defaults", which is the correct and
 * common case.
 */

const COLUMNS = 'weights, review_count, loss, fitted_at'

/** A learner's fitted weights, or `null` to mean "use the published defaults". */
export async function weightsFor(supabase) {
  const row = unwrap(
    await supabase.from('fsrs_weights').select(COLUMNS).maybeSingle(),
    "read your fitted weights",
  )

  if (!row?.weights) return null

  return {
    weights: row.weights.map(Number),
    reviewCount: Number(row.review_count) || 0,
    loss: row.loss == null ? null : Number(row.loss),
    fittedAt: row.fitted_at,
  }
}

/**
 * Store a fresh fit, replacing whatever the learner had before.
 *
 * An upsert rather than an insert-then-update: recomputing is the only
 * write this table ever sees, and the primary key makes "replace mine" and
 * "create mine" the same statement.
 */
export async function saveWeights(
  supabase,
  { userId, weights, reviewCount, loss, now = new Date() },
) {
  return unwrap(
    await supabase
      .from('fsrs_weights')
      .upsert(
        {
          user_id: userId,
          weights,
          review_count: reviewCount,
          loss,
          fitted_at: new Date(now).toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select(COLUMNS)
      .single(),
    'save your fitted weights',
  )
}

/**
 * Every review this learner has logged, oldest first — the raw material
 * `src/lib/review/fit-weights.js` fits against. Kept as its own read rather
 * than folded into `weightsFor` so the "recompute" action can decide whether
 * there is enough history before it starts a fit.
 */
export async function reviewLogFor(supabase) {
  return unwrapList(
    await supabase
      .from('reviews')
      .select('artefact_id, rating, reviewed_at')
      .order('reviewed_at', { ascending: true }),
    'read your review history',
  )
}
