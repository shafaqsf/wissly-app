'use server'

import { revalidatePath } from 'next/cache'

import { requireUserId } from '@/lib/auth/user.js'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/data/notifications.js'
import { createClient } from '@/lib/supabase/server.js'

/* What the bell calls. Both verbs are the same shape as the archive/restore
 * actions in task.js: a plain form action, no return value, a refresh of
 * every page under the frame the bell renders in — which is every page,
 * because the bell lives in the dashboard layout. */

function refresh() {
  revalidatePath('/dashboard', 'layout')
}

export async function markNotificationReadAction(formData) {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return

  const supabase = await createClient()
  await requireUserId(supabase)

  await markNotificationRead(supabase, { id })
  refresh()
}

export async function markAllNotificationsReadAction() {
  const supabase = await createClient()
  await requireUserId(supabase)

  await markAllNotificationsRead(supabase)
  refresh()
}
