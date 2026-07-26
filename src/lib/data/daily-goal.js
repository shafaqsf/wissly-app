import { DEFAULT_HORIZON_DAYS, suggestDailyGoal } from '../review/daily-goal.js'
import { subjectById } from './subjects.js'
import { unwrapList } from './result.js'

/* What "on track" means for one course, read fresh on every call.
 *
 * The horizon is the exam date when the course has one, and a fixed
 * lookahead otherwise. `totalDue` and `completedToday` are both read from
 * `artefact_schedule` and `reviews` rather than cached, so the number moves
 * the moment a review lands or a day turns over — that movement is the
 * "adaptive" the feature is named for, not a property of the arithmetic. */

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(value) {
  const date = new Date(value)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

export async function dailyGoalFor(supabase, { subjectId, now = new Date() }) {
  const subject = await subjectById(supabase, { id: subjectId })
  if (!subject) return null

  const today = startOfDay(now)
  const horizonEnd = subject.exam_date
    ? startOfDay(subject.exam_date)
    : new Date(today.getTime() + DEFAULT_HORIZON_DAYS * DAY_MS)

  const daysRemaining = Math.round((horizonEnd.getTime() - today.getTime()) / DAY_MS)

  const rows = unwrapList(
    await supabase
      .from('artefact_schedule')
      .select('artefact_id, next_due_at')
      .eq('subject_id', subjectId),
    'read the upcoming reviews',
  )

  const totalDue = rows.filter((row) => new Date(row.next_due_at) <= horizonEnd).length
  const artefactIds = rows.map((row) => row.artefact_id)

  const todayReviews =
    artefactIds.length === 0
      ? []
      : unwrapList(
          await supabase
            .from('reviews')
            .select('id')
            .in('artefact_id', artefactIds)
            .gte('reviewed_at', today.toISOString()),
          "read today's reviews",
        )

  const goal = suggestDailyGoal({
    totalDue,
    daysRemaining,
    completedToday: todayReviews.length,
  })

  return {
    subjectId: subject.id,
    subjectTitle: subject.title,
    examDate: subject.exam_date ?? null,
    ...goal,
  }
}
