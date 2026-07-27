'use client';

/* What the review queue calls to rate a task. Online, this is indistinguishable
 * from calling the server action directly — the point is what happens when it
 * is not: offline, or the server call itself throws (the same "offline" from
 * the network's side rather than the browser's), the rating is queued instead
 * of lost, for `flushPendingReviews` (src/lib/offline/sync.js) to replay once
 * the connection is back.
 *
 * `action`, `isOnline` and `enqueue` are parameters rather than the concrete
 * server action, `navigator.onLine` and `enqueueReview` so this stays a pure
 * function to test — the review queue supplies the real ones.
 */
export async function submitRating({ artefactId, rating, action, isOnline, enqueue }) {
  if (isOnline()) {
    try {
      return await action({ artefactId, rating })
    } catch {
      // The network lied about being up, or the request never landed —
      // either way, this is the offline case now.
    }
  }

  await enqueue({ artefactId, rating })
  return { queued: true }
}
