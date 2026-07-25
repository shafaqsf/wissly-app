import { unwrap, unwrapList } from './result.js'

/* A run, and the actions it took.
 *
 * These rows are wissly's observability. The SDK ships its own tracing, but
 * it exports to OpenAI's backend keyed by an OpenAI API key we do not have,
 * and it would tell us nothing per learner. These tables are better on every
 * count that matters here: they are owned, they are subject to row level
 * security, and they outlive the request.
 *
 * `agent_actions` holds only writes. A row here means something changed, and
 * `undo` is the payload that would change it back — written at the time of
 * the action, while the previous state is still known. Reads are not
 * recorded; there would be one row per search and nothing to undo.
 */

const RUN_COLUMNS =
  'id, conversation_id, message_id, agent, model, mode, status, usage, error, started_at, ended_at'
const ACTION_COLUMNS = 'id, run_id, tool, arguments, result, undo, undone_at, created_at'

const RUN_STATUSES = new Set(['running', 'done', 'stopped', 'interrupted', 'failed'])

export async function startRun(
  supabase,
  { userId, conversationId, messageId = null, agent, model, mode },
) {
  return unwrap(
    await supabase
      .from('agent_runs')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        message_id: messageId,
        agent,
        model,
        mode,
        status: 'running',
      })
      .select(RUN_COLUMNS)
      .single(),
    'start the run',
  )
}

export async function endRun(
  supabase,
  { id, status, usage = null, error = null, now = () => new Date() },
) {
  if (!RUN_STATUSES.has(status)) {
    throw new Error(`"${status}" is not a run status.`)
  }

  return unwrap(
    await supabase
      .from('agent_runs')
      .update({
        status,
        usage,
        // The learner reads this. A stack trace is not an explanation.
        error: error ? String(error).slice(0, 500) : null,
        ended_at: now().toISOString(),
      })
      .eq('id', id)
      .select(RUN_COLUMNS)
      .single(),
    'finish the run',
  )
}

export async function runsFor(supabase, { conversationId }) {
  return unwrapList(
    await supabase
      .from('agent_runs')
      .select(RUN_COLUMNS)
      .eq('conversation_id', conversationId)
      .order('started_at', { ascending: false }),
    'read the runs',
  )
}

/**
 * Record a write the agent made, together with what would undo it.
 *
 * Agent mode acts without asking at each step. That is only defensible if
 * every act is legible afterwards and reversible, and this row is both.
 */
export async function recordAction(
  supabase,
  { userId, runId, tool, args = {}, result = null, undo = null },
) {
  return unwrap(
    await supabase
      .from('agent_actions')
      .insert({
        user_id: userId,
        run_id: runId,
        tool,
        arguments: args,
        result,
        undo,
      })
      .select(ACTION_COLUMNS)
      .single(),
    'record what the agent did',
  )
}

/** What a run changed, oldest first — the order an undo has to walk backwards. */
export async function actionsFor(supabase, { runId }) {
  return unwrapList(
    await supabase
      .from('agent_actions')
      .select(ACTION_COLUMNS)
      .eq('run_id', runId)
      .order('created_at', { ascending: true }),
    'read what the agent did',
  )
}

/**
 * Stamp an action as taken back.
 *
 * `is('undone_at', null)` is the whole point: two clicks on Undo must not
 * apply the inverse twice, and the guard belongs in the statement rather than
 * in the component that issued it.
 */
export async function markUndone(supabase, { id, now = () => new Date() }) {
  return unwrap(
    await supabase
      .from('agent_actions')
      .update({ undone_at: now().toISOString() })
      .eq('id', id)
      .is('undone_at', null)
      .select(ACTION_COLUMNS)
      .maybeSingle(),
    'undo what the agent did',
  )
}
