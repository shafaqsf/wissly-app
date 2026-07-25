import { unwrap, unwrapList } from './result.js'

/* Standing orders: what the agent does with nobody present.
 *
 * An order is an instruction and a schedule — "notice concepts below
 * `--grain-2` and generate more", weekly. Nothing here runs anything; the
 * trigger is not a page load and does not live in the data layer. These
 * functions are the record the trigger reads and stamps.
 *
 * `schedule` is plain text rather than a parsed cron shape because the
 * scheduler is not built yet, and a column shape guessed before its consumer
 * exists is a migration waiting to be undone.
 *
 * An order is the one thing in the product the learner can genuinely delete.
 * There is nothing to archive: a switched-off order is already the thing an
 * archive would be for, and `enabled` says it in one column.
 */

const COLUMNS = 'id, instruction, schedule, enabled, last_run_at, created_at'

export async function listStandingOrders(supabase, { enabled } = {}) {
  let query = supabase.from('standing_orders').select(COLUMNS)

  if (enabled !== undefined) {
    query = query.eq('enabled', enabled)
  }

  return unwrapList(
    await query.order('created_at', { ascending: false }),
    'list your standing orders',
  )
}

export async function getStandingOrder(supabase, { id }) {
  return unwrap(
    await supabase.from('standing_orders').select(COLUMNS).eq('id', id).maybeSingle(),
    'open the standing order',
  )
}

export async function createStandingOrder(
  supabase,
  { userId, instruction, schedule, enabled = true },
) {
  const text = String(instruction ?? '').trim()
  const when = String(schedule ?? '').trim()

  if (!text) {
    throw new Error('A standing order needs an instruction. Say what the agent should do.')
  }
  if (!when) {
    throw new Error('A standing order needs a schedule. Nothing would ever run it.')
  }

  return unwrap(
    await supabase
      .from('standing_orders')
      .insert({ user_id: userId, instruction: text, schedule: when, enabled })
      .select(COLUMNS)
      .single(),
    'create the standing order',
  )
}

/** Change one. Only what was passed is written. */
export async function updateStandingOrder(supabase, { id, instruction, schedule, enabled }) {
  const patch = {
    ...(instruction === undefined ? {} : { instruction: String(instruction).trim() }),
    ...(schedule === undefined ? {} : { schedule: String(schedule).trim() }),
    ...(enabled === undefined ? {} : { enabled }),
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('That edit changes nothing.')
  }
  if (patch.instruction === '') {
    throw new Error('A standing order needs an instruction.')
  }
  if (patch.schedule === '') {
    throw new Error('A standing order needs a schedule.')
  }

  return unwrap(
    await supabase.from('standing_orders').update(patch).eq('id', id).select(COLUMNS).single(),
    'save the standing order',
  )
}

/** The switch. Separate from the editor because it is one click, not a form. */
export async function setStandingOrderEnabled(supabase, { id, enabled }) {
  return unwrap(
    await supabase
      .from('standing_orders')
      .update({ enabled })
      .eq('id', id)
      .select(COLUMNS)
      .single(),
    enabled ? 'switch the standing order on' : 'switch the standing order off',
  )
}

/** Stamp an order as having run. What it did lands as a message in a thread. */
export async function markStandingOrderRun(supabase, { id, now = () => new Date() }) {
  return unwrap(
    await supabase
      .from('standing_orders')
      .update({ last_run_at: now().toISOString() })
      .eq('id', id)
      .select(COLUMNS)
      .single(),
    'record the standing order run',
  )
}

export async function deleteStandingOrder(supabase, { id }) {
  unwrap(
    await supabase.from('standing_orders').delete().eq('id', id),
    'delete the standing order',
  )
  return { id }
}
