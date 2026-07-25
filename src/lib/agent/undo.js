import 'server-only'

import { actionsFor, markUndone } from '../data/agent-runs.js'
import { assertLearnerClient } from './guard.js'
import { applyUndo } from './write-tools.js'

/**
 * Take back what a run changed.
 *
 * Newest first. A run that renamed a course and then renamed it again has two
 * rows, and replaying their inverses in the order they were written would
 * restore the middle state rather than the original.
 *
 * `markUndone` guards on `undone_at is null` in the statement itself, so the
 * inverse cannot be applied twice — two clicks on Undo, or two tabs, resolve
 * to one. An action whose inverse fails is left unstamped: it is still
 * outstanding, and reporting it as taken back would be a lie the learner
 * cannot see through.
 */
export async function undoRun(supabase, { runId }) {
  // An undo is a write like any other, so it acts as the learner like any
  // other. It reverses what they can see, under the policies they act under.
  assertLearnerClient(supabase)

  const actions = await actionsFor(supabase, { runId })

  const undone = []
  const failed = []

  for (const action of [...actions].reverse()) {
    if (action.undone_at || !action.undo) continue

    try {
      const claimed = await markUndone(supabase, { id: action.id })
      // Somebody else got there first. Not an error, and not our work to redo.
      if (!claimed) continue

      await applyUndo(supabase, { undo: action.undo })
      undone.push(action.tool)
    } catch (error) {
      failed.push({ tool: action.tool, reason: error.message })
    }
  }

  return { undone, failed }
}

/** What the learner is told. Counts, in their terms, never row ids. */
export function describeUndo({ undone, failed }) {
  if (undone.length === 0 && failed.length === 0) {
    return 'There was nothing to take back.'
  }

  const parts = []

  if (undone.length > 0) {
    parts.push(
      `Took back ${undone.length} change${undone.length === 1 ? '' : 's'}.`,
    )
  }

  if (failed.length > 0) {
    parts.push(
      `${failed.length} could not be taken back: ${failed
        .map((entry) => entry.reason)
        .join('; ')}`,
    )
  }

  return parts.join(' ')
}
