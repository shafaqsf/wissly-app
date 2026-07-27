/**
 * The weekly report: a plain object built from numbers a caller already
 * gathered, and the email rendered from it. Pure end to end — nothing here
 * reads a clock or a database — which is what makes it exhaustively
 * testable and keeps "what the report says" separate from "what it took to
 * find that out" (`weekly-report-data.js`) and "where it goes"
 * (`email-sender.js`, `send-weekly-report.js`).
 */

const RATING_LABELS = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }

function round(value, places = 3) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function ratingCount(ratingCounts, rating) {
  return Number(ratingCounts?.[rating] ?? 0)
}

/**
 * @param {object} input
 * @param {string} input.periodStart ISO timestamp, inclusive
 * @param {string} input.periodEnd ISO timestamp, exclusive
 * @param {number} input.reviewsDone reviews graded in the period
 * @param {{1?: number, 2?: number, 3?: number, 4?: number}} input.ratingCounts
 * @param {number} input.masteryNow mean concept mastery right now, 0..1
 * @param {number|null} [input.masteryBefore] mean mastery at `periodStart`, if known
 * @param {number} input.streakDays consecutive days with at least one review, ending today
 * @param {number} input.dueNext7Days artefacts due within the next 7 days
 * @returns {object} a plain, JSON-serialisable report
 */
export function buildWeeklyReport({
  periodStart,
  periodEnd,
  reviewsDone,
  ratingCounts = {},
  masteryNow,
  masteryBefore = null,
  streakDays = 0,
  dueNext7Days = 0,
}) {
  const again = ratingCount(ratingCounts, 1)
  const hard = ratingCount(ratingCounts, 2)
  const good = ratingCount(ratingCounts, 3)
  const easy = ratingCount(ratingCounts, 4)

  const accuracy = reviewsDone > 0 ? round((good + easy) / reviewsDone) : null
  const masteryDelta = typeof masteryBefore === 'number' ? round(masteryNow - masteryBefore) : null

  const todos = []

  if (masteryDelta === null) {
    todos.push(
      'Mastery delta is null: there is no mastery snapshot from the start of the period to diff ' +
        'against. The momentum/analytics branches were designed to add a mastery-history table; ' +
        'once one lands, pass its start-of-period reading in as masteryBefore and this stops being ' +
        'approximate.',
    )
  }

  todos.push(
    'This report is computed from artefacts, reviews, concept_mastery and artefact_schedule only. ' +
      'A per-subject breakdown, a true "what changed" diff per concept, and any richer streak or ' +
      'goal tracking belong to whatever the momentum/analytics branches add on top of those base ' +
      'tables — this function has no dependency on that code existing.',
  )

  return {
    period: { start: periodStart, end: periodEnd },
    headline: headlineFor({ reviewsDone, streakDays }),
    stats: {
      reviewsDone,
      ratingCounts: { again, hard, good, easy },
      accuracy,
      masteryNow: round(masteryNow),
      masteryDelta,
      streakDays,
      dueNext7Days,
    },
    todos,
  }
}

function headlineFor({ reviewsDone, streakDays }) {
  if (reviewsDone === 0) {
    return 'A quiet week — nothing was reviewed.'
  }

  const streakPart = streakDays > 1 ? `, ${streakDays} days running` : ''
  return `${reviewsDone} review${reviewsDone === 1 ? '' : 's'} this week${streakPart}.`
}

function percent(value) {
  return `${Math.round(value * 100)}%`
}

function sentenceFor(report) {
  const { stats } = report
  const lines = []

  lines.push(report.headline)

  if (stats.reviewsDone > 0) {
    const { again, hard, good, easy } = stats.ratingCounts
    lines.push(
      `You rated ${again} again, ${hard} hard, ${good} good and ${easy} easy` +
        (stats.accuracy !== null ? `, for ${percent(stats.accuracy)} remembered.` : '.'),
    )
  }

  if (stats.masteryDelta !== null) {
    const direction = stats.masteryDelta >= 0 ? 'up' : 'down'
    lines.push(`Mastery is at ${percent(stats.masteryNow)}, ${direction} ${percent(Math.abs(stats.masteryDelta))} on the week.`)
  } else {
    lines.push(`Mastery is at ${percent(stats.masteryNow)} right now.`)
  }

  if (stats.dueNext7Days > 0) {
    lines.push(
      `${stats.dueNext7Days} card${stats.dueNext7Days === 1 ? '' : 's'} ${stats.dueNext7Days === 1 ? 'is' : 'are'} due over the next 7 days.`,
    )
  } else {
    lines.push('Nothing is due in the next 7 days.')
  }

  return lines.join(' ')
}

/**
 * Render a report as an email. `to` is the only thing about the recipient
 * this function needs — it does not read a user profile or a settings row,
 * which keeps it a pure transform like the report itself.
 *
 * @param {ReturnType<typeof buildWeeklyReport>} report
 * @param {{to: string}} recipient
 * @returns {{to: string, subject: string, text: string}}
 */
export function emailFromReport(report, { to }) {
  const subject =
    report.stats.reviewsDone > 0
      ? `Your week: ${report.stats.reviewsDone} review${report.stats.reviewsDone === 1 ? '' : 's'}`
      : 'Your week on wissly'

  return {
    to,
    subject,
    text: sentenceFor(report),
  }
}

export { RATING_LABELS }
