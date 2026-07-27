import { gatherWeeklyReportData } from '@/lib/data/weekly-report.js'

import { defaultEmailSender } from './email-sender.js'
import { buildWeeklyReport, emailFromReport } from './weekly-report.js'

/**
 * Gather this learner's week, build the report, and hand it to an
 * `EmailSender` — see `email-sender.js`. `sender` defaults to the console
 * stub; passing a real implementation (once one exists) is the only change
 * a caller needs to make to actually deliver mail. Nothing above this
 * function knows or cares which sender it got.
 *
 * `gather` is injected for the same reason `now` is: a test should not have
 * to run the real Supabase query to prove this function wires three pieces
 * together correctly.
 */
export async function sendWeeklyReport(
  supabase,
  { userId, email, now = new Date(), sender = defaultEmailSender(), gather = gatherWeeklyReportData } = {},
) {
  const data = await gather(supabase, { userId, now })
  const report = buildWeeklyReport(data)
  const message = emailFromReport(report, { to: email })

  return sender.send(message)
}
