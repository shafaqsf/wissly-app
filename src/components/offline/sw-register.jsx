'use client';

import { useEffect } from 'react';

import { flushPendingReviews } from '@/lib/offline/sync.js';

/* Pure wiring, rendered once from the root layout: register `public/sw.js`
 * where the browser supports it, and drain the offline queue (src/lib/
 * offline/queue.js) on mount and again on every `online` event — see the
 * note atop sync.js for why a plain event listener rather than Background
 * Sync. Nothing here is itself a behaviour worth a unit test beyond "did it
 * call the two things it is wiring together", which is what this tests. */
export default function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline on first load, or the browser refused for its own reasons —
        // either way, the page still works without it.
      });
    }

    flushPendingReviews();
    window.addEventListener('online', flushPendingReviews);
    return () => window.removeEventListener('online', flushPendingReviews);
  }, []);

  return null;
}
