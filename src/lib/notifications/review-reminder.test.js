import { describe, expect, it } from 'vitest'

import { decideReviewReminder, reminderBody, reminderTitle } from './review-reminder.js'

const NOW = new Date('2026-07-26T09:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

describe('deciding whether to remind a learner about their queue', () => {
  it('says nothing when nothing is due', () => {
    expect(decideReviewReminder({ dueItems: [], now: NOW })).toBeNull()
  })

  it('says nothing the moment a card becomes due, before recall has actually decayed', () => {
    // Stability of 10 days, last reviewed 10 days ago: retrievability is
    // still ~0.9, exactly the target retention FSRS scheduled it for. There
    // is nothing yet to be urgent about.
    const dueItems = [
      { artefactId: 'a1', stability: 10, dueAt: NOW.toISOString(), lastReviewedAt: NOW.toISOString() },
    ]

    expect(decideReviewReminder({ dueItems, now: NOW })).toBeNull()
  })

  it('fires once recall has decayed past the notify threshold', () => {
    // Stability of 5 days, last reviewed 20 days ago: recall has fallen well
    // below the 0.9 it was scheduled at.
    const lastReviewedAt = new Date(NOW.getTime() - 20 * DAY_MS).toISOString()
    const dueItems = [{ artefactId: 'a1', stability: 5, dueAt: lastReviewedAt, lastReviewedAt }]

    const reminder = decideReviewReminder({ dueItems, now: NOW })

    expect(reminder).not.toBeNull()
    expect(reminder.kind).toBe('review_due')
    expect(reminder.data.dueCount).toBe(1)
    expect(reminder.data.avgRetrievability).toBeLessThan(0.85)
  })

  it('treats material that has never been reviewed as maximally urgent', () => {
    const dueItems = [
      { artefactId: 'a1', stability: null, dueAt: NOW.toISOString(), lastReviewedAt: null },
    ]

    const reminder = decideReviewReminder({ dueItems, now: NOW })

    expect(reminder).not.toBeNull()
    expect(reminder.data.avgRetrievability).toBe(0)
  })

  it('does not repeat itself once a reminder has already been sent for the same state', () => {
    const lastReviewedAt = new Date(NOW.getTime() - 20 * DAY_MS).toISOString()
    const dueItems = [{ artefactId: 'a1', stability: 5, dueAt: lastReviewedAt, lastReviewedAt }]

    const first = decideReviewReminder({ dueItems, now: NOW })
    const lastNotification = {
      created_at: NOW.toISOString(),
      data: first.data,
    }

    // Nothing changed since: same items, same clock. Reminding again would be
    // noise, not information.
    const second = decideReviewReminder({ dueItems, now: NOW, lastNotification })

    expect(second).toBeNull()
  })

  it('reminds again once recall has decayed further than it had at the last reminder', () => {
    const reviewedAt = new Date(NOW.getTime() - 20 * DAY_MS).toISOString()
    const dueItems = [{ artefactId: 'a1', stability: 5, dueAt: reviewedAt, lastReviewedAt: reviewedAt }]

    const lastNotification = {
      created_at: new Date(NOW.getTime() - 5 * DAY_MS).toISOString(),
      // Recall was already recorded as fading, but not this far — recall
      // only ever falls further while a card sits unreviewed.
      data: { dueCount: 1, avgRetrievability: 0.79 },
    }

    const reminder = decideReviewReminder({ dueItems, now: NOW, lastNotification })

    expect(reminder).not.toBeNull()
    expect(reminder.data.avgRetrievability).toBeLessThan(0.79)
  })

  it('reminds again once the queue has grown, even if recall has not moved', () => {
    const lastNotification = {
      created_at: NOW.toISOString(),
      data: { dueCount: 1, avgRetrievability: 0.5 },
    }
    const dueItems = [
      { artefactId: 'a1', stability: null, dueAt: NOW.toISOString(), lastReviewedAt: null },
      { artefactId: 'a2', stability: null, dueAt: NOW.toISOString(), lastReviewedAt: null },
    ]

    const reminder = decideReviewReminder({ dueItems, now: NOW, lastNotification })

    expect(reminder).not.toBeNull()
    expect(reminder.data.dueCount).toBe(2)
  })
})

describe('the words a reminder carries', () => {
  it('names the count in the title, singular and plural', () => {
    expect(reminderTitle(1)).toMatch(/1 review is due/i)
    expect(reminderTitle(8)).toMatch(/8 reviews are due/i)
  })

  it('tells the learner what happened and what to do, never apologising', () => {
    const body = reminderBody(8, 0.6)
    expect(body).not.toMatch(/sorry/i)
    expect(body.toLowerCase()).toContain('review')
  })
})
