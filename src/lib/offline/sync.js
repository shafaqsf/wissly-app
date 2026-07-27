'use client';

import { listPendingReviews, removePendingReview } from './queue.js';

/* Flushing the queue back to the server, on reconnect.
 *
 * No Background Sync API: it is unsupported in Safari and behind a flag
 * history in others, so relying on it would leave part of the audience with
 * a queue that never drains itself. `window.addEventListener('online', …)`
 * plus a flush on load covers the same case — the connection came back —
 * with nothing that needs feature-detecting.
 *
 * Order matters and failure has to be conservative about it: a review two
 * days old still has to land before one from this morning, or FSRS scores a
 * schedule that never happened. So this stops at the first review a *retry*
 * might fix (a network error, a 5xx, a 429) rather than skipping past it —
 * the rest stay queued for the next reconnect. A review the server will
 * never accept (404 — the artefact or the queue entry it named is gone) is
 * the one case worth clearing anyway and moving on from, because no amount
 * of retrying fixes a row that is not there.
 */

const RETRY_LATER = new Set([408, 429, 500, 502, 503, 504]);

export async function flushPendingReviews({
  fetchImpl = typeof fetch === 'function' ? fetch : undefined,
  queue = { list: listPendingReviews, remove: removePendingReview },
} = {}) {
  const pending = await queue.list();

  for (const review of pending) {
    let response;
    try {
      response = await fetchImpl('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artefactId: review.artefactId, rating: review.rating }),
      });
    } catch {
      // Offline again, or the request otherwise never reached the server.
      // Leave this and everything behind it queued.
      return;
    }

    if (response.ok) {
      await queue.remove(review.id);
      continue;
    }

    if (RETRY_LATER.has(response.status)) return;

    // A permanent failure — nothing left to retry.
    await queue.remove(review.id);
  }
}
