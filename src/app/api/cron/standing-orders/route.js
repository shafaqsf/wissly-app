import { createHash, timingSafeEqual } from 'node:crypto'

import { createClient as createTokenClient } from '@supabase/supabase-js'

import { runDueStandingOrders } from '@/lib/agent/standing-orders.js'
import { currentUserId } from '@/lib/auth/user.js'
import { createClient } from '@/lib/supabase/server.js'

/**
 * The tick. One order, nobody present.
 *
 * This is the only place in wissly where the agent acts with no learner
 * watching, which makes it the only place where two things that are otherwise
 * automatic have to be argued for.
 *
 * ## Who may ask
 *
 * A cron endpoint anyone can POST to is an invitation to spend someone else's
 * money: there is no spending cap in this product, deliberately, and every tick
 * is a model call. So the route refuses without a shared secret — `CRON_SECRET`
 * in the environment, compared in constant time against the `Authorization:
 * Bearer` header. A secret that is not configured is not a reason to run
 * unauthenticated; it is a reason to refuse (503) until somebody sets it.
 *
 * The comparison hashes both sides before `timingSafeEqual` so that a wrong
 * *length* is as uninformative as a wrong value — `timingSafeEqual` throws on
 * mismatched lengths, and the throw is itself a timing signal.
 *
 * ## Who it acts as — and what that costs
 *
 * Everywhere else the answer is free: the request carries a session cookie and
 * the request-scoped client is the learner. A cron caller has no cookies, and
 * `runDueStandingOrders` calls `assertLearnerClient`, so the obvious shortcut —
 * `SUPABASE_SECRET_KEY` — is not available and must not be made available. It
 * would bypass row level security entirely, which is to say it would hand a
 * prompt injection in an uploaded lecture handout the whole database rather
 * than one learner's own rows. The guard exists precisely to stop this route
 * being where that rule breaks.
 *
 * So identity arrives as a **learner refresh token**, handed over in the body,
 * and exchanged for a session on a client built with the *publishable* key. The
 * result is an ordinary learner client, subject to exactly the policies the
 * learner is subject to. Running unattended does not mean running with more
 * authority.
 *
 * **The trade-off, stated plainly.** A refresh token is a bearer credential: it
 * is being signed in as that learner, it does not expire on a schedule the
 * product controls, and it can only be revoked by signing the learner's
 * sessions out. Whoever runs the cron therefore holds, for each learner they
 * tick, something as sensitive as a password — and wissly does not store it, so
 * that "whoever" is an operator with an environment variable per learner, which
 * does not scale past a handful of people. It is the narrower of two bad
 * options: this credential can act as exactly one learner, whereas the secret
 * key can act as all of them and RLS stops protecting anything. The honest
 * long-term fix is a per-learner scheduler token issued and revocable inside
 * the product, with its own table and its own policy. That is a migration and a
 * settings surface, and it is not built yet.
 *
 * As a fallback, a request that carries a real session — a learner's browser,
 * or a signed-in operator poking the endpoint — is accepted as that learner. It
 * still needs the secret. This is what makes the route usable in development
 * without anyone copying a refresh token out of local storage.
 */

export const runtime = 'nodejs'

function json(body, status = 200) {
  return Response.json(body, { status })
}

/** Length-blind constant-time comparison of two secrets. */
function sameSecret(given, expected) {
  if (typeof given !== 'string' || given === '') return false

  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()

  return timingSafeEqual(a, b)
}

/** The secret as the caller presented it, from either header wissly accepts. */
function presentedSecret(request) {
  const authorization = request.headers.get('authorization') ?? ''
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)

  return bearer ? bearer[1] : request.headers.get('x-cron-secret')
}

/**
 * Carry out one due standing order.
 *
 * Body: `{ refreshToken?, limit?, now? }`. Header: `Authorization: Bearer
 * $CRON_SECRET`.
 *
 * Answers `{ due, ran }` — how many orders were due, and what the ones that ran
 * did. One per tick by default, least recently run first; both of those are
 * `runDueStandingOrders`'s decisions, not this route's.
 */
export async function POST(request) {
  const expected = String(process.env.CRON_SECRET ?? '').trim()
  if (expected === '') {
    return json(
      {
        error:
          'CRON_SECRET is not set, so standing orders cannot be triggered. There is no unauthenticated mode: a tick costs money.',
      },
      503,
    )
  }

  if (!sameSecret(presentedSecret(request), expected)) {
    return json({ error: 'Not for you.' }, 401)
  }

  let body = {}
  try {
    body = (await request.json()) ?? {}
  } catch {
    // A cron caller with an empty body is ordinary; it means "use the session".
    body = {}
  }

  const { refreshToken, limit = 1, now } = body

  let supabase
  let userId

  if (refreshToken) {
    supabase = createTokenClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    )

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })

    if (error || !data?.user) {
      return json({ error: 'That token no longer names a learner.' }, 401)
    }

    userId = data.user.id
  } else {
    supabase = await createClient()
    userId = await currentUserId(supabase)
  }

  if (!userId) {
    return json(
      { error: 'The tick named no learner. Hand over a refresh token or call it signed in.' },
      401,
    )
  }

  try {
    const result = await runDueStandingOrders({
      supabase,
      userId,
      limit,
      ...(now ? { now: new Date(now) } : {}),
    })

    return json(result)
  } catch (error) {
    return json({ error: error?.message ?? String(error) }, 500)
  }
}
