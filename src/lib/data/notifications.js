import { unwrap, unwrapList } from './result.js'

/* The notification centre.
 *
 * `read_at` is a timestamp, not a boolean, for the reason `pinned_at` and
 * `archived_at` are in conversations and sources: null is the absence of the
 * state, and a timestamp can be shown ("read 2 days ago") where a boolean
 * cannot.
 *
 * `kind` is free text rather than a check constraint, matching
 * `messages.model` in migration 006: the set of notification kinds will grow
 * with the product, and a constraint here would go stale between one
 * migration and the next.
 */

const COLUMNS = 'id, kind, title, body, data, created_at, read_at'

const DEFAULT_LIMIT = 20

/** Most recent first, capped to what a bell can reasonably show. */
export async function listNotifications(supabase, { limit = DEFAULT_LIMIT } = {}) {
  return unwrapList(
    await supabase
      .from('notifications')
      .select(COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit),
    'read your notifications',
  )
}

/** How many unread rows the badge should show. */
export async function unreadNotificationCount(supabase) {
  const rows = unwrapList(
    await supabase.from('notifications').select('id').is('read_at', null),
    'count your notifications',
  )

  return rows.length
}

/**
 * The most recent notification of one kind, or null if that kind has never
 * been sent. What `decideReviewReminder` compares its next decision against.
 */
export async function latestNotificationOfKind(supabase, { kind }) {
  const row = unwrap(
    await supabase
      .from('notifications')
      .select(COLUMNS)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'read your notifications',
  )

  return row ?? null
}

/** Write one. `data` carries whatever the decision that produced it needs to render or re-decide later. */
export async function createNotification(supabase, { userId, kind, title, body, data = {} }) {
  return unwrap(
    await supabase
      .from('notifications')
      .insert({ user_id: userId, kind, title, body, data })
      .select(COLUMNS)
      .single(),
    'send the notification',
  )
}

/** @param {{now?: () => Date}} options `now` is injected so tests can fix it. */
export async function markNotificationRead(supabase, { id, now = () => new Date() }) {
  return unwrap(
    await supabase
      .from('notifications')
      .update({ read_at: now().toISOString() })
      .eq('id', id)
      .select(COLUMNS)
      .single(),
    'mark the notification read',
  )
}

/** One statement over every unread row, not a loop that half-applies on failure. */
export async function markAllNotificationsRead(supabase, { now = () => new Date() } = {}) {
  return unwrapList(
    await supabase
      .from('notifications')
      .update({ read_at: now().toISOString() })
      .is('read_at', null)
      .select(COLUMNS),
    'mark your notifications read',
  )
}
