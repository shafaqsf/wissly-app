import { dueScheduleItems } from '@/lib/data/review.js'
import { createNotification, latestNotificationOfKind } from '@/lib/data/notifications.js'

import { decideReviewReminder, REVIEW_DUE_KIND } from './review-reminder.js'

/**
 * Check a learner in against their own queue, and notify them if the moment
 * the FSRS decay curve says is worth interrupting them for has arrived.
 *
 * Called from the dashboard layout on every load rather than from a cron
 * job or a third-party scheduler — see `docs/CONVENTIONS.md` and the task
 * brief this feature shipped under: no external service is wired up here.
 * Because `decideReviewReminder` only fires again once recall has decayed
 * further or the queue has grown, calling this on every page view is safe:
 * most calls decide there is nothing new to say and write nothing.
 */
export async function ensureReviewReminder(supabase, { userId, now = new Date() } = {}) {
  const [dueItems, lastNotification] = await Promise.all([
    dueScheduleItems(supabase, { now }),
    latestNotificationOfKind(supabase, { kind: REVIEW_DUE_KIND }),
  ])

  const decision = decideReviewReminder({ dueItems, now, lastNotification })

  if (!decision) return null

  return createNotification(supabase, { userId, ...decision })
}
