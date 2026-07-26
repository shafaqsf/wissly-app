/* wissly's service worker.
 *
 * Small on purpose: this is not a general offline app, it is one screen —
 * the review queue — kept usable on a flaky connection. Two things:
 *
 * 1. `GET /api/review/due` (see src/app/api/review/due/route.js) is cached on
 *    every successful fetch, network-first, so a learner who opens the queue
 *    offline sees the last due list it saw rather than an empty page.
 * 2. A navigation request (opening a page) falls back to whatever was last
 *    cached for that address when the network is unreachable at all, rather
 *    than the browser's own offline page.
 *
 * Everything else passes straight through — this worker does not try to be a
 * full app-shell cache, only the one path offline review actually needs.
 */

const CACHE = 'wissly-offline-v1'
const DUE_PATH = '/api/review/due'

self.addEventListener('install', (event) => {
  // Take over immediately rather than waiting for every open tab to close —
  // there is no animated "update available" moment to protect (no autoplay,
  // no motion the learner did not ask for either way).
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname === DUE_PATH) {
    event.respondWith(networkFirst(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
  }
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE)

  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw error
  }
}
