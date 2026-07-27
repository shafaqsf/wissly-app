// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { sendWeeklyReport } from './send-weekly-report.js'

const NOW = new Date('2026-07-26T09:00:00.000Z')

function fakeGather(overrides = {}) {
  return vi.fn(async () => ({
    periodStart: '2026-07-19T09:00:00.000Z',
    periodEnd: '2026-07-26T09:00:00.000Z',
    reviewsDone: 12,
    ratingCounts: { 1: 1, 2: 1, 3: 6, 4: 4 },
    masteryNow: 0.6,
    masteryBefore: null,
    streakDays: 3,
    dueNext7Days: 5,
    ...overrides,
  }))
}

describe('sending the weekly report', () => {
  it('gathers, builds, and hands the email to the sender it was given', async () => {
    const gather = fakeGather()
    const send = vi.fn(async () => ({ delivered: false, id: null }))
    const supabase = {}

    const result = await sendWeeklyReport(supabase, {
      userId: 'user-1',
      email: 'learner@example.com',
      now: NOW,
      gather,
      sender: { send },
    })

    expect(gather).toHaveBeenCalledWith(supabase, { userId: 'user-1', now: NOW })
    expect(send).toHaveBeenCalledTimes(1)
    const [message] = send.mock.calls[0]
    expect(message.to).toBe('learner@example.com')
    expect(message.subject).toMatch(/12/)
    expect(result).toEqual({ delivered: false, id: null })
  })

  it('uses the console stub when no sender is given, never a real provider', async () => {
    const gather = fakeGather()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await sendWeeklyReport({}, { userId: 'user-1', email: 'learner@example.com', now: NOW, gather })

    expect(log).toHaveBeenCalled()
    expect(result.delivered).toBe(false)
    log.mockRestore()
  })
})
