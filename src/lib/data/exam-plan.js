import { compressedPlan } from '../review/plan.js'
import { subjectById } from './subjects.js'
import { unwrapList } from './result.js'

/* The compressed review plan for one course, computed fresh from its current
 * `artefact_schedule` state — see `src/lib/review/plan.js` for the pure
 * scheduling logic this wraps. A course with no exam date has nothing to
 * compress against, so this reads null rather than guessing a horizon; the
 * daily goal (`src/lib/data/daily-goal.js`) is what a course without a date
 * still gets. */

const SCHEDULE_COLUMNS = 'artefact_id, stability, next_due_at, last_reviewed_at'

export async function examPlanFor(supabase, { subjectId, now = new Date() }) {
  const subject = await subjectById(supabase, { id: subjectId })
  if (!subject?.exam_date) return null

  const rows = unwrapList(
    await supabase.from('artefact_schedule').select(SCHEDULE_COLUMNS).eq('subject_id', subjectId),
    'read the schedule for the exam plan',
  )

  const schedule = rows.map((row) => ({
    artefactId: row.artefact_id,
    stability: row.stability == null ? null : Number(row.stability),
    dueAt: row.next_due_at,
    lastReviewedAt: row.last_reviewed_at,
  }))

  const days = compressedPlan({ schedule, examDate: subject.exam_date, now })

  return {
    subjectId: subject.id,
    subjectTitle: subject.title,
    examDate: subject.exam_date,
    days,
  }
}
