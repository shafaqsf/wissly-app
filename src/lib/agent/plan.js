/**
 * A suggested study plan, built from three things that are already true about
 * a course: what is due, where mastery is weakest, and which sections have
 * nothing generated from them yet.
 *
 * This is a pure function over those three lists — no database, no model
 * call — for the same reason `formats.js` and `navigation.js` are pure: the
 * shape of a plan is a business rule, and a business rule that can only be
 * tested through a fake Supabase client is a rule nobody actually tests.
 *
 * The plan is a *suggestion* surfaced in the transcript, never a write. The
 * learner accepts an item by asking for it, which reaches the same
 * `make_artefacts` write path — with its usual `agent_actions` row and undo —
 * that every other generation goes through. Nothing here schedules or
 * generates anything on its own.
 */

/** More sessions than this in one plan stops being a suggestion and starts being a syllabus. */
const MAX_SESSIONS = 12

/** Items per session, if the caller does not say. Enough for one sitting. */
const DEFAULT_SESSION_SIZE = 3

/**
 * @param {object} params
 * @param {number} [params.dueCount] how many reviews are due now
 * @param {Array<{id: string, name: string, mastery: number, sectionOrdinal?: number|null}>} [params.gaps]
 *   concepts that have been answered and are not yet mastered, worst first
 * @param {Array<{id: string, ordinal: number, sourceId?: string, sourceTitle?: string}>} [params.ungenerated]
 *   sections nothing has been generated from yet
 * @param {number} [params.sessionSize] items per session, 1 to 10
 * @returns {{sessions: Array<{session: number, items: Array<object>}>,
 *   totals: {review: number, gaps: number, ungenerated: number}}}
 */
export function buildStudyPlan({ dueCount = 0, gaps = [], ungenerated = [], sessionSize } = {}) {
  const size = Math.min(Math.max(Number(sessionSize) || DEFAULT_SESSION_SIZE, 1), 10)

  // Order of intent, not of urgency alone: clear what is already scheduled
  // first (it was due for a reason), then shore up what evidence says is
  // weak, then read what has not been touched at all. A learner who only has
  // time for the first session still did the most load-bearing thing.
  const items = [
    ...(dueCount > 0
      ? [
          {
            kind: 'review',
            label: `Clear ${dueCount} due review${dueCount === 1 ? '' : 's'}`,
            count: dueCount,
          },
        ]
      : []),
    ...gaps.map((gap) => ({
      kind: 'gap',
      label: `Strengthen "${gap.name}"`,
      conceptId: gap.id,
      mastery: gap.mastery,
      sectionOrdinal: gap.sectionOrdinal ?? null,
    })),
    ...ungenerated.map((section) => ({
      kind: 'new',
      label: `Generate from section ${section.ordinal}${section.sourceTitle ? ` of "${section.sourceTitle}"` : ''}`,
      sectionId: section.id,
      sourceId: section.sourceId ?? null,
      sourceTitle: section.sourceTitle ?? null,
    })),
  ]

  const sessions = []
  for (let index = 0; index < items.length && sessions.length < MAX_SESSIONS; index += size) {
    sessions.push({ session: sessions.length + 1, items: items.slice(index, index + size) })
  }
  if (sessions.length === 0) sessions.push({ session: 1, items: [] })

  return {
    sessions,
    totals: { review: dueCount, gaps: gaps.length, ungenerated: ungenerated.length },
  }
}
