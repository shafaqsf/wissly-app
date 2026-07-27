// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getClaims, requireUserId, sendWeeklyReport } = vi.hoisted(() => ({
  getClaims: vi.fn(async () => ({ data: { claims: { sub: 'user-1', email: 'learner@example.com' } } })),
  requireUserId: vi.fn(async () => 'user-1'),
  sendWeeklyReport: vi.fn(async () => ({ delivered: false, id: null })),
}))

const supabase = { auth: { getClaims } }

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => supabase) }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId }))
vi.mock('@/lib/notifications/send-weekly-report.js', () => ({ sendWeeklyReport }))

import { sendWeeklyReportAction } from './weekly-report.js'

beforeEach(() => {
  vi.clearAllMocks()
  getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1', email: 'learner@example.com' } } })
  requireUserId.mockResolvedValue('user-1')
  sendWeeklyReport.mockResolvedValue({ delivered: false, id: null })
})

describe('the settings "send weekly report now" action', () => {
  it('sends this learner their own report, to the address on their account', async () => {
    const result = await sendWeeklyReportAction()

    expect(requireUserId).toHaveBeenCalledWith(supabase)
    expect(sendWeeklyReport).toHaveBeenCalledWith(supabase, {
      userId: 'user-1',
      email: 'learner@example.com',
    })
    expect(result.message).toMatch(/log/i)
  })

  it('says plainly that nothing was actually emailed', async () => {
    const result = await sendWeeklyReportAction()

    expect(result.message).not.toMatch(/sent to your inbox|delivered to your email/i)
  })

  it('refuses when the account carries no address', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1', email: null } } })

    const result = await sendWeeklyReportAction()

    expect(sendWeeklyReport).not.toHaveBeenCalled()
    expect(result.message).toMatch(/no address/i)
  })
})
