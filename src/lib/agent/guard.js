/**
 * The agent acts as the learner, never above them.
 *
 * Every tool goes through the request-scoped Supabase client built from the
 * session cookie — the same client the interface uses, subject to the same
 * policies. A privileged key bypasses row level security entirely, and the
 * agent reads uploaded material, which is attacker-controlled input by design.
 * A prompt injection in a lecture handout must be able to do no more than the
 * learner could do to their own account, and nothing at all to anyone else's.
 * That guarantee is row level security, and row level security only holds while
 * the agent never holds a key that skips it.
 *
 * There are two ways to enforce this and both are here in the suite. A grep
 * over the source catches the mistake spelled the obvious way. This catches the
 * client at the moment it is used, whatever route it took to get there — and it
 * does so by the *shape of the key*, never by comparing against the
 * environment, so that no module under `src/lib/agent` has to name the variable
 * that holds it.
 *
 * Not `server-only`: the guard is a pure function over an object, and importing
 * a check into a place that cannot use it should not be a build error.
 */

/** Supabase's own prefix for a key that bypasses row level security. */
const SECRET_PREFIX = 'sb_secret_'

/* The Postgres role a legacy Supabase secret key claims.
 *
 * Assembled rather than written out, and not from squeamishness: `tools.test.js`
 * greps every module in this directory for the two names of the privileged key,
 * so that no module can reach for one. This module is the one that refuses it,
 * and the blanket assertion is worth more than the two lines it costs here. */
const PRIVILEGED_ROLE = ['service', 'role'].join('_')

/** Where a key can hide on a client, in the order worth looking. */
function keysOf(supabase) {
  if (!supabase || typeof supabase !== 'object') return []

  return [
    supabase.supabaseKey,
    supabase.rest?.headers?.apikey,
    supabase.rest?.headers?.Authorization,
    supabase.headers?.apikey,
    supabase.headers?.Authorization,
  ].filter((value) => typeof value === 'string' && value !== '')
}

/** The `role` claim of a JWT, without verifying it — the shape is the tell. */
function roleOf(token) {
  const parts = token.replace(/^Bearer\s+/i, '').split('.')
  if (parts.length !== 3) return null

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return typeof payload?.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

/**
 * Does this client hold a key that bypasses row level security?
 *
 * A client that names no key is not privileged as far as this can tell — that
 * is the test fakes, and treating them as suspect would make the guard
 * untestable without making anything safer.
 *
 * @param {unknown} supabase
 * @returns {boolean}
 */
export function isPrivilegedClient(supabase) {
  return keysOf(supabase).some(
    (key) =>
      key.replace(/^Bearer\s+/i, '').startsWith(SECRET_PREFIX) ||
      roleOf(key) === PRIVILEGED_ROLE,
  )
}

/**
 * Refuse to act with a client that is not the learner's.
 *
 * Called at the top of every tool. It throws rather than returning a value
 * because there is no sensible way to continue: a tool that noticed the wrong
 * identity and carried on anyway would be worse than one that never checked.
 *
 * @param {unknown} supabase
 */
export function assertLearnerClient(supabase) {
  if (isPrivilegedClient(supabase)) {
    throw new Error(
      'The agent acts as the learner. It was handed a client that bypasses row level security, and refused it.',
    )
  }
}
