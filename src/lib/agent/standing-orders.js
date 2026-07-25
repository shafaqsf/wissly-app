import 'server-only'

import {
  createConversation,
  appendMessage,
  listConversations,
} from '../data/conversations.js'
import {
  listStandingOrders,
  markStandingOrderRun,
} from '../data/standing-orders.js'
import { assertLearnerClient } from './guard.js'
import { runTurn as runOneTurn } from './run.js'

/**
 * The third level of reach: the agent decides.
 *
 * A standing order is an instruction with a schedule — "top up any concept
 * below half mastery", weekly — carried out with nobody present. This module is
 * the runtime half: which orders are due, and what running one means. It builds
 * no cron, no queue and no route. `runDueStandingOrders` is a plain exported
 * function; something with a clock calls it, and what that something is, is not
 * this module's business.
 *
 * Three decisions are worth stating, because each one looks arbitrary and is
 * not:
 *
 * **The report lands as a message in a thread.** `agent_runs.conversation_id`
 * is NOT NULL and stays that way. Everything the agent ever did is in one
 * place, in the same shape, whether a person asked for it or a schedule did —
 * so "what did it do while I was away" is reading a thread rather than a second
 * kind of log with a second interface on it.
 *
 * **One order per call.** A tick is a chance to do something, not an
 * opportunity to empty a queue. Ten orders coming due together should cost ten
 * ticks, not one very long request that dies in the middle of the fourth.
 *
 * **An order that fails is still stamped as run.** Otherwise a broken
 * instruction is retried on every tick forever, and the learner's first sign of
 * it is the bill.
 */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const PHRASES = {
  hourly: HOUR,
  daily: DAY,
  nightly: DAY,
  weekly: 7 * DAY,
  fortnightly: 14 * DAY,
  monthly: 30 * DAY,
}

const UNITS = {
  minute: MINUTE,
  minutes: MINUTE,
  hour: HOUR,
  hours: HOUR,
  day: DAY,
  days: DAY,
  week: 7 * DAY,
  weeks: 7 * DAY,
  month: 30 * DAY,
  months: 30 * DAY,
}

/**
 * How long between runs, or null when the schedule cannot be read.
 *
 * `schedule` is free text — the column was left that way deliberately, because
 * guessing a shape before the scheduler existed would have been a migration to
 * undo. Null rather than a default is the honest answer to something
 * unreadable: an order that quietly ran daily because nobody could parse
 * "sometimes" would be acting on an instruction the learner never gave.
 *
 * @param {string} schedule
 * @returns {number|null}
 */
export function intervalMs(schedule) {
  const text = String(schedule ?? '').trim().toLowerCase()
  if (text === '') return null

  if (PHRASES[text]) return PHRASES[text]

  const every = text.match(/^every\s+(\d+)?\s*([a-z]+)$/)
  if (every) {
    const count = Number(every[1] ?? 1)
    const unit = UNITS[every[2]]
    if (unit && count > 0) return count * unit
  }

  return null
}

/** @param {object} order @param {{now?: Date}} [options] */
export function isDue(order, { now = new Date() } = {}) {
  if (!order?.enabled) return false

  const interval = intervalMs(order.schedule)
  if (interval === null) return false

  // Never run is due now. An order the learner has just written should not
  // wait a week to prove it works.
  if (!order.last_run_at) return true

  return new Date(now).getTime() - new Date(order.last_run_at).getTime() >= interval
}

/**
 * The orders that are due, least recently run first.
 *
 * The ordering matters when more than one comes due at once and only one runs:
 * without it, the same order would win every tick and the others would never
 * run at all.
 */
export async function dueStandingOrders(supabase, { now = new Date() } = {}) {
  assertLearnerClient(supabase)

  const orders = await listStandingOrders(supabase, { enabled: true })

  return orders
    .filter((order) => isDue(order, { now }))
    .sort((a, b) => stamp(a.last_run_at) - stamp(b.last_run_at))
}

function stamp(value) {
  return value ? new Date(value).getTime() : 0
}

/** The thread an order posts into, named after the order itself. */
function titleFor(order) {
  const instruction = String(order.instruction ?? '').trim()
  const short = instruction.length > 60 ? `${instruction.slice(0, 60)}…` : instruction
  return `Standing order — ${short}`
}

async function threadFor(supabase, { userId, order }) {
  const title = titleFor(order)

  const existing = (await listConversations(supabase)).find(
    (conversation) => conversation.title === title,
  )
  if (existing) return existing

  return createConversation(supabase, { userId, title, mode: 'agent' })
}

/**
 * Carry out one order.
 *
 * The instruction is posted as the learner's own message, because that is what
 * it is: something they said in advance. The transcript then reads the way
 * every other thread reads, and the answer is an ordinary assistant message
 * with ordinary `agent_actions` behind it — which means Undo works on it
 * without knowing that a schedule rather than a person asked.
 *
 * @param {object} params
 * @param {object} params.supabase
 * @param {string} params.userId
 * @param {object} params.order
 * @param {Date} [params.now]
 * @param {Function} [params.runTurn]
 * @returns {Promise<{standing_order_id: string, conversation_id: string,
 *   message: object|null, error: string|null}>}
 */
export async function runStandingOrder({
  supabase,
  userId,
  order,
  now = new Date(),
  runTurn = runOneTurn,
  ...rest
}) {
  assertLearnerClient(supabase)

  const conversation = await threadFor(supabase, { userId, order })

  const instruction = await appendMessage(supabase, {
    userId,
    conversationId: conversation.id,
    role: 'user',
    content: [
      order.instruction,
      '',
      '(This is a standing order. Nobody is here to answer a question, so do',
      'what it says as far as you can and report what you did.)',
    ].join('\n'),
    mode: 'agent',
    busy: false,
  })

  let turn = null
  let error = null

  try {
    turn = await runTurn({
      ...rest,
      supabase,
      userId,
      conversation: { ...conversation, mode: 'agent' },
      message: instruction,
      trigger: 'schedule',
    })
  } catch (cause) {
    error = cause?.message ?? String(cause)
  }

  // Stamped whatever happened. An order that failed and was left unstamped
  // would run again on the next tick, and the tick after that.
  await markStandingOrderRun(supabase, { id: order.id, now: () => now })

  return {
    standing_order_id: order.id,
    conversation_id: conversation.id,
    message: turn?.message ?? null,
    completed: turn?.completed ?? [],
    error,
  }
}

/**
 * The entry point a scheduled route calls. One tick, one order.
 *
 * Deliberately not a route, not a cron expression and not a worker. It takes
 * the learner's own request-scoped client like everything else here, so a
 * standing order acts under exactly the policies the learner acts under —
 * running unattended must not mean running with more authority.
 *
 * @param {object} params
 * @param {object} params.supabase the learner's request-scoped client
 * @param {string} params.userId
 * @param {Date} [params.now]
 * @param {number} [params.limit] how many to run this tick
 * @returns {Promise<{due: number, ran: Array<object>}>}
 */
export async function runDueStandingOrders({
  supabase,
  userId,
  now = new Date(),
  limit = 1,
  ...rest
}) {
  assertLearnerClient(supabase)

  const due = await dueStandingOrders(supabase, { now })
  const ran = []

  for (const order of due.slice(0, Math.max(Number(limit) || 1, 1))) {
    ran.push(await runStandingOrder({ ...rest, supabase, userId, order, now }))
  }

  return { due: due.length, ran }
}
