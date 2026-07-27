'use client';

/* Where a review rating waits when the server could not be reached.
 *
 * `localStorage` rather than IndexedDB: see the note atop `queue.test.js` for
 * why. Everything in this file is synchronous underneath and `async` only so
 * that a future move to IndexedDB — if the queue ever needs to hold more
 * than a rating and an artefact id — changes no caller. */

const KEY = 'wissly:pending-reviews';

function read() {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupted storage is not a reason to lose the ability to review offline
    // going forward — treat it as an empty queue rather than throwing.
    return [];
  }
}

function write(entries) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(entries));
}

function id() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** @param {{artefactId: string, rating: number}} review */
export async function enqueueReview({ artefactId, rating }) {
  const entries = read();
  entries.push({ id: id(), artefactId, rating, queuedAt: new Date().toISOString() });
  write(entries);
}

export async function listPendingReviews() {
  return read();
}

export async function removePendingReview(entryId) {
  write(read().filter((entry) => entry.id !== entryId));
}
