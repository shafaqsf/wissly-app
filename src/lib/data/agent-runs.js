import { MASTERED_AT } from '../mastery.js'
import { listConcepts, listConceptMastery } from './concepts.js'
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

/* --- What the dashboard and analytics read ---------------------------
 *
 * The agent acts on its own now and there is deliberately no spending cap,
 * so what it did and what it cost have to be readable where the learner
 * passes daily. These are the reads behind those surfaces.
 */

/**
 * OpenRouter's list prices, per million tokens, for the three models the bar
 * offers by name. The bar also takes any other id, and a model that is not
 * here prices at zero rather than at a guess — a fabricated figure on a cost
 * surface is worse than an obviously absent one.
 */
export const MODEL_PRICES = Object.freeze({
  'deepseek/deepseek-v4-pro': { input: 0.44, output: 0.87 },
  'anthropic/claude-sonnet-5': { input: 2.0, output: 10.0 },
  'openai/gpt-5.6-luna': { input: 1.0, output: 6.0 },
})

const PER_MILLION = 1_000_000

/** What one run cost, in dollars. */
export function runCost(run) {
  const usage = run?.usage
  if (!usage) return 0

  // OpenRouter can bill the exact figure back to us. When it has, that is
  // the number — our own arithmetic is only a fallback.
  if (Number.isFinite(Number(usage.cost))) return Number(usage.cost)

  const price = MODEL_PRICES[run?.model]
  if (!price) return 0

  const input = Number(usage.prompt_tokens ?? 0)
  const output = Number(usage.completion_tokens ?? 0)

  return (input / PER_MILLION) * price.input + (output / PER_MILLION) * price.output
}

/** The UTC day a timestamp falls in, as `YYYY-MM-DD`. */
function dayOf(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

/** The `days` calendar days ending today, oldest first. */
function windowOf(days, now) {
  const end = new Date(now)
  end.setUTCHours(0, 0, 0, 0)

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(end)
    day.setUTCDate(day.getUTCDate() - (days - 1 - index))
    return day
  })
}

/**
 * What the agent did with nobody present, newest first.
 *
 * Two queries rather than an embed, like every other read in this layer: the
 * runs that nobody asked for, then the writes they made. An action already
 * taken back is not news, so it never reaches the panel.
 */
export async function autonomousActions(supabase, { limit = 5 } = {}) {
  const runs = unwrapList(
    await supabase
      .from('agent_runs')
      .select('id, started_at')
      .eq('trigger', 'schedule')
      .order('started_at', { ascending: false })
      .limit(limit * 4),
    'read what the agent did on its own',
  )

  if (runs.length === 0) return []

  const actions = unwrapList(
    await supabase
      .from('agent_actions')
      .select(ACTION_COLUMNS)
      .in(
        'run_id',
        runs.map((run) => run.id),
      )
      .is('undone_at', null)
      .order('created_at', { ascending: false })
      .limit(limit),
    'read what the agent did on its own',
  )

  return actions.map((action) => ({
    id: action.id,
    runId: action.run_id,
    tool: action.tool,
    args: action.arguments ?? {},
    result: action.result ?? null,
    createdAt: action.created_at,
  }))
}

/**
 * Model calls and cost per day, and by cause.
 *
 * The cause is `agent_runs.trigger`: work the learner asked for against work
 * the agent decided to do. Without the split the effort surface would say how
 * much was spent and not the one thing worth knowing about it.
 */
export async function effortByDay(supabase, { days = 7, now = new Date() } = {}) {
  const window = windowOf(days, now)

  const runs = unwrapList(
    await supabase
      .from('agent_runs')
      .select('id, trigger, model, usage, started_at')
      .gte('started_at', window[0].toISOString())
      .order('started_at', { ascending: true }),
    'read what the agent has cost',
  )

  const buckets = new Map(
    window.map((day) => [
      dayOf(day),
      { date: dayOf(day), calls: 0, cost: 0, byCause: { user: 0, schedule: 0 } },
    ]),
  )

  for (const run of runs) {
    const bucket = buckets.get(dayOf(run.started_at))
    if (!bucket) continue

    const cost = runCost(run)
    const cause = run.trigger === 'schedule' ? 'schedule' : 'user'

    bucket.calls += 1
    bucket.cost += cost
    bucket.byCause[cause] += cost
  }

  return [...buckets.values()]
}

/**
 * Reviews per day. A frequency histogram and nothing else: no percentage, no
 * streak. How often you turned up is a fact; a streak is a judgement.
 */
export async function reviewsByDay(supabase, { days = 7, now = new Date() } = {}) {
  const window = windowOf(days, now)

  const reviews = unwrapList(
    await supabase
      .from('reviews')
      .select('id, reviewed_at')
      .gte('reviewed_at', window[0].toISOString()),
    'read your week',
  )

  const buckets = new Map(window.map((day) => [dayOf(day), { date: dayOf(day), reviews: 0 }]))

  for (const review of reviews) {
    const bucket = buckets.get(dayOf(review.reviewed_at))
    if (bucket) bucket.reviews += 1
  }

  return [...buckets.values()]
}

/**
 * The gap report: what demonstrably does not hold yet.
 *
 * "Demonstrably" is the whole definition. A concept at mastery 0 has never
 * been answered, so nothing has been demonstrated about it — it is untouched,
 * not a gap. A gap is a concept that has produced evidence and the evidence
 * is not good enough yet, and it is named beside the material it came from so
 * the answer to it is one click away.
 */
export async function gapConcepts(supabase, { subjectId, limit = 20 } = {}) {
  const [scored, concepts] = await Promise.all([
    listConceptMastery(supabase, { subjectId }),
    listConcepts(supabase, { subjectId }),
  ])

  const gaps = scored
    .filter((concept) => concept.mastery > 0 && concept.mastery < MASTERED_AT)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, limit)

  if (gaps.length === 0) return []

  const sectionOf = new Map(concepts.map((concept) => [concept.id, concept.section_id ?? null]))
  const sectionIds = [...new Set([...gaps].map((gap) => sectionOf.get(gap.id)).filter(Boolean))]

  const sections =
    sectionIds.length === 0
      ? []
      : unwrapList(
          await supabase
            .from('sections')
            .select('id, source_id, ordinal')
            .in('id', sectionIds),
          'find where the gap came from',
        )

  const sourceIds = [...new Set(sections.map((section) => section.source_id))]

  const sources =
    sourceIds.length === 0
      ? []
      : unwrapList(
          await supabase.from('sources').select('id, title').in('id', sourceIds),
          'find where the gap came from',
        )

  const bySection = new Map(sections.map((section) => [section.id, section]))
  const bySource = new Map(sources.map((source) => [source.id, source]))

  return gaps.map((gap) => {
    const section = bySection.get(sectionOf.get(gap.id)) ?? null
    const source = section ? (bySource.get(section.source_id) ?? null) : null

    return {
      id: gap.id,
      subjectId: gap.subjectId,
      name: gap.name,
      mastery: gap.mastery,
      sectionOrdinal: section?.ordinal ?? null,
      source: source ? { id: source.id, title: source.title } : null,
    }
  })
}

/**
 * What is due, and how much of it is already late.
 *
 * Two numbers rather than a list: the dashboard says "12 tasks due · 3
 * overdue" and links into the queue. Pulling thirty rows back to count them
 * would be the same read the queue itself does, on a page that shows none of
 * them.
 */
export async function dueCounts(supabase, { subjectId, now = new Date() } = {}) {
  let query = supabase
    .from('artefact_schedule')
    .select('artefact_id, next_due_at')
    .lte('next_due_at', new Date(now).toISOString())

  if (subjectId) query = query.eq('subject_id', subjectId)

  const rows = unwrapList(await query, 'read your queue')

  const startOfToday = new Date(now)
  startOfToday.setUTCHours(0, 0, 0, 0)

  return {
    due: rows.length,
    // Late means it fell due on a day that has already ended. Something due
    // this morning is due, not overdue, and calling it overdue by lunchtime
    // is the interface nagging.
    overdue: rows.filter((row) => new Date(row.next_due_at) < startOfToday).length,
  }
}
