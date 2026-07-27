'use server'

import { requireUserId } from '@/lib/auth/user.js'
import { sendWeeklyReport } from '@/lib/notifications/send-weekly-report.js'
import { createClient } from '@/lib/supabase/server.js'

/**
 * The one reachable end of the weekly report in the product today: a button
 * in Settings, for a learner to preview their own report on demand rather
 * than wait for a schedule this project does not run yet.
 *
 * It sends through `sendWeeklyReport`'s default `EmailSender`, the console
 * stub — nothing here reaches a real inbox, and the message returned says so
 * in words rather than implying delivery happened.
 */
export async function sendWeeklyReportAction() {
  const supabase = await createClient()
  const userId = await requireUserId(supabase)

  const { data } = await supabase.auth.getClaims()
  const email = data?.claims?.email ?? null

  if (!email) {
    return { message: 'This account carries no address to send a report to.' }
  }

  await sendWeeklyReport(supabase, { userId, email })

  return {
    message:
      'Your report was built. Email delivery is not wired up yet, so it was written to the server log instead of your inbox.',
  }
}
