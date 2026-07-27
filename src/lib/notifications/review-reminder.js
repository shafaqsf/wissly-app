/**
 * When to tell a learner their queue needs them, and what to say.
 *
 * Not a clock. A dumb reminder fires on a fixed schedule — "every day at
 * nine" — whether or not anything has actually happened. This one fires when
 * `src/lib/review/fsrs.js`'s own forgetting curve says recall has decayed
 * past the point the scheduler was aiming for, which is the FSRS-optimal
 * moment: the instant a nudge starts being worth more than the interruption
 * it costs.
 *
 * `retrievability(elapsedDays, stability)` already models this — see
 * `src/lib/review/fsrs.js`. Nothing here re-derives the curve; this module
 * only decides the threshold and the re-notify rule on top of it.
 */

import { retrievability } from '@/lib/review/fsrs.js'

export const REVIEW_DUE_KIND = 'review_due'

/**
 * Recall probability below which the queue is worth interrupting a learner
 * about. FSRS schedules a card to come due at ~0.9 retrievability (the
 * default `requestRetention`), so this sits a little under that — a card
 * that just became due has not earned a notification yet; one whose recall
 * has kept sliding after that has.
 */
const NOTIFY_THRESHOLD = 0.8

/**
 * How much further retrievability has to fall since the last reminder before
 * a new one is worth sending. Without a margin, two calls a second apart with
 * a clock that has barely moved would both fire.
 */
const RENOTIFY_DROP = 0.02

const DAY_MS = 24 * 60 * 60 * 1000

function toDate(value) {
  return value instanceof Date ? value : new Date(value)
}

/**
 * Recall probability for one due item, right now.
 *
 * An item that has never been reviewed carries no stability — there is no
 * memory yet to decay — and is scored 0: maximally urgent, because there is
 * no evidence at all that it is known.
 */
function itemRetrievability(item, now) {
  if (item.stability == null) return 0

  const last = toDate(item.lastReviewedAt ?? item.dueAt)
  const elapsedDays = Math.max((toDate(now).getTime() - last.getTime()) / DAY_MS, 0)

  return retrievability(elapsedDays, item.stability)
}

/** The mean recall probability across every item currently due. */
function averageRetrievability(dueItems, now) {
  const total = dueItems.reduce((sum, item) => sum + itemRetrievability(item, now), 0)
  return total / dueItems.length
}

/** `"1 review is due"` / `"8 reviews are due"`. */
export function reminderTitle(dueCount) {
  return dueCount === 1 ? '1 review is due' : `${dueCount} reviews are due`
}

/** What happened, and what to do about it — never an apology. */
export function reminderBody(dueCount, avgRetrievability) {
  const noun = dueCount === 1 ? 'card' : 'cards'

  if (avgRetrievability < 0.65) {
    return `Recall has faded on ${dueCount} ${noun}. A quick review now brings more back than a longer one later.`
  }

  return `${dueCount} ${noun} are ready for review. A few minutes now keeps them from slipping further.`
}

/**
 * Decide whether to notify a learner about their due queue, and with what.
 *
 * @param {object} options
 * @param {Array<{artefactId: string, stability: number|null, dueAt: string, lastReviewedAt: string|null}>} options.dueItems
 *   Every artefact currently due, from `artefact_schedule`.
 * @param {Date|string} [options.now]
 * @param {{created_at: string, data: {dueCount: number, avgRetrievability: number}}|null} [options.lastNotification]
 *   The most recent `review_due` notification already sent, if any.
 * @returns {{kind: string, title: string, body: string, data: {dueCount: number, avgRetrievability: number}}|null}
 */
export function decideReviewReminder({ dueItems = [], now = new Date(), lastNotification = null } = {}) {
  if (dueItems.length === 0) return null

  const urgency = averageRetrievability(dueItems, now)

  if (urgency > NOTIFY_THRESHOLD) return null

  if (lastNotification) {
    const previousUrgency = lastNotification.data?.avgRetrievability
    const previousCount = lastNotification.data?.dueCount

    const decayedFurther =
      typeof previousUrgency === 'number' && urgency <= previousUrgency - RENOTIFY_DROP
    const queueGrew = typeof previousCount === 'number' && dueItems.length > previousCount

    if (!decayedFurther && !queueGrew) return null
  }

  return {
    kind: REVIEW_DUE_KIND,
    title: reminderTitle(dueItems.length),
    body: reminderBody(dueItems.length, urgency),
    data: {
      dueCount: dueItems.length,
      avgRetrievability: Math.round(urgency * 1000) / 1000,
    },
  }
}
