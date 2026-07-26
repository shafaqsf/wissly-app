import { scheduleReview } from '@/lib/review/fsrs.js'

import { withSections } from './artefacts.js'
import { weightsFor } from './fsrs-weights.js'
import { unwrap, unwrapList } from './result.js'

/* The queue, and what happens after a rating.
 *
 * `reviews` is an event log: one row per grading, never updated. The current
 * state of an artefact is its most recent row, which `artefact_schedule`
 * already resolves — see migration 004. Nothing here re-derives it. */

const SCHEDULE_COLUMNS =
  'artefact_id, subject_id, section_id, concept_id, format, payload, ' +
  'stability, difficulty, reps, lapses, due_at, last_reviewed_at, next_due_at'

/** More than this in one sitting is not a session, it is a punishment. */
const DEFAULT_LIMIT = 30

/**
 * What is due now, oldest first, with the passage each artefact cites.
 *
 * An artefact that has never been reviewed has `next_due_at = created_at`,
 * so new material is due the moment it exists. That is deliberate: the point
 * of generating it was to answer it.
 */
export async function dueArtefacts(supabase, { subjectId, now = new Date(), limit = DEFAULT_LIMIT } = {}) {
  let query = supabase
    .from('artefact_schedule')
    .select(SCHEDULE_COLUMNS)
    .lte('next_due_at', new Date(now).toISOString())
    .order('next_due_at', { ascending: true })
    .limit(limit)

  if (subjectId) {
    query = query.eq('subject_id', subjectId)
  }

  const rows = unwrapList(await query, 'read your queue')

  // The view names the artefact `artefact_id`; the renderers want `id`.
  const artefacts = await withSections(
    supabase,
    rows.map((row) => ({ ...row, id: row.artefact_id })),
  )

  return artefacts.map((artefact, index) => ({
    ...artefact,
    state: fsrsState(rows[index]),
  }))
}

/** The FSRS state carried on a schedule row, or null for a first review. */
export function fsrsState(row) {
  if (!row || row.stability == null) return null

  return {
    stability: Number(row.stability),
    difficulty: Number(row.difficulty),
    reps: Number(row.reps ?? 0),
    lapses: Number(row.lapses ?? 0),
    due_at: row.due_at,
    last_reviewed_at: row.last_reviewed_at,
  }
}

/** The state of one artefact, read fresh. Used when a rating arrives. */
export async function scheduleFor(supabase, { artefactId }) {
  const row = unwrap(
    await supabase
      .from('artefact_schedule')
      .select(SCHEDULE_COLUMNS)
      .eq('artefact_id', artefactId)
      .maybeSingle(),
    'read the schedule',
  )

  return row ?? null
}

/**
 * Record a rating and set the next date.
 *
 * The scheduler decides when; this only writes down what it decided. The row
 * is appended, never updated — the history is what lets the mastery view
 * distinguish "got it right once" from "gets it right".
 *
 * Which weights the scheduler uses is looked up here, not chosen by the
 * caller: a learner with a fitted vector in `fsrs_weights` schedules on it,
 * everyone else schedules on the published FSRS-4.5 defaults `fsrs.js`
 * already falls back to when `weights` is `undefined`. `fsrs.js` itself never
 * learns any of this — it stays a pure function of state, rating and
 * whatever weight vector it is handed.
 */
export async function recordReview(supabase, { userId, artefactId, rating, state, now = new Date() }) {
  if (![1, 2, 3, 4].includes(Number(rating))) {
    throw new Error('A rating is one of the four buttons, nothing else.')
  }

  const fitted = await weightsFor(supabase)
  const next = scheduleReview({
    state: state ?? undefined,
    rating: Number(rating),
    now,
    weights: fitted?.weights,
  })

  return unwrap(
    await supabase
      .from('reviews')
      .insert({
        user_id: userId,
        artefact_id: artefactId,
        reviewed_at: new Date(now).toISOString(),
        rating: Number(rating),
        stability: next.stability,
        difficulty: next.difficulty,
        due_at: next.due_at,
        reps: next.reps,
        lapses: next.lapses,
      })
      .select('id, artefact_id, rating, due_at, reps, lapses')
      .single(),
    'record the review',
  )
}
