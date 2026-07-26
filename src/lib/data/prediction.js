import { windowOf } from './agent-runs.js'
import { listConceptMastery } from './concepts.js'
import { unwrapList } from './result.js'

/** How far back "recent pace" looks when projecting improvement. */
const VELOCITY_WINDOW_DAYS = 14

/**
 * Everything `src/lib/predict/exam-pass.js` needs for one course, gathered
 * in three reads: the concepts and their mastery, how much of the queue has
 * fallen overdue, and how many reviews the learner has actually been
 * logging lately. The prediction itself is a pure function; this is only
 * the assembly.
 */
export async function examPassInputs(supabase, { subjectId, now = new Date() } = {}) {
  const [concepts, scheduleResult] = await Promise.all([
    listConceptMastery(supabase, { subjectId }),
    supabase.from('artefact_schedule').select('artefact_id, next_due_at').eq('subject_id', subjectId),
  ])
  const schedule = unwrapList(scheduleResult, 'read the queue')

  // "Overdue" matches dueCounts in agent-runs.js: fell due on a day that has
  // already ended, not merely due earlier today.
  const startOfToday = new Date(now)
  startOfToday.setUTCHours(0, 0, 0, 0)

  const overdueFraction =
    schedule.length > 0
      ? schedule.filter((row) => new Date(row.next_due_at) < startOfToday).length / schedule.length
      : 0

  const artefactIds = schedule.map((row) => row.artefact_id)

  const recentReviews =
    artefactIds.length === 0
      ? []
      : unwrapList(
          await supabase
            .from('reviews')
            .select('id, reviewed_at')
            .in('artefact_id', artefactIds)
            .gte('reviewed_at', windowOf(VELOCITY_WINDOW_DAYS, now)[0].toISOString()),
          'read your recent pace',
        )

  return {
    concepts,
    overdueFraction,
    reviewsPerDay: recentReviews.length / VELOCITY_WINDOW_DAYS,
  }
}
