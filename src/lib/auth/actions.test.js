// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.mock` is hoisted above every `const`, so the doubles it closes over
// have to be hoisted with it.
const { auth, redirect } = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  redirect: vi.fn((url) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => ({ auth })) }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { signIn, signOut, signUp } from './actions.js'

/** Where a call to `redirect` was pointed, or null if it was not called. */
async function destinationOf(promise) {
  try {
    await promise
  } catch (error) {
    if (String(error.message).startsWith('NEXT_REDIRECT:')) {
      return String(error.message).slice('NEXT_REDIRECT:'.length)
    }
    throw error
  }
  return null
}

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null })
  auth.signUp.mockResolvedValue({ data: { session: {} }, error: null })
  auth.signOut.mockResolvedValue({ error: null })
})

describe('signing in', () => {
  it('passes the credentials to Supabase', async () => {
    await destinationOf(signIn({}, form({ email: 'a@b.co', password: 'hunter22' })))

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'hunter22',
    })
  })

  it('lands on the dashboard', async () => {
    const to = await destinationOf(signIn({}, form({ email: 'a@b.co', password: 'hunter22' })))

    expect(to).toBe('/dashboard')
  })

  it('returns to where the visitor was going', async () => {
    const to = await destinationOf(
      signIn({}, form({ email: 'a@b.co', password: 'hunter22', next: '/dashboard/subjects' })),
    )

    expect(to).toBe('/dashboard/subjects')
  })

  it('refuses to follow an absolute destination', async () => {
    const to = await destinationOf(
      signIn({}, form({ email: 'a@b.co', password: 'hunter22', next: 'https://evil.test' })),
    )

    expect(to).toBe('/dashboard')
  })

  it('says what happened and what to do when the credentials are wrong', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    })

    const state = await signIn({}, form({ email: 'a@b.co', password: 'hunter22' }))

    expect(state.message).toMatch(/do not match/i)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('says the address is unconfirmed rather than blaming the password', async () => {
    // Proven against a real project: Supabase answers a *correct* password on
    // an unconfirmed address with 400 email_not_confirmed. Collapsing that into
    // "these do not match" tells the learner to fix the one thing that is not
    // broken, and leaves them no way out of the loop.
    auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    })

    const state = await signIn({}, form({ email: 'a@b.co', password: 'hunter22' }))

    expect(state.message).not.toMatch(/do not match/i)
    expect(state.message).toMatch(/confirm/i)
    expect(state.message).toContain('a@b.co')
  })

  it('recognises the unconfirmed state from the message when no code is given', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Email not confirmed' },
    })

    const state = await signIn({}, form({ email: 'a@b.co', password: 'hunter22' }))

    expect(state.message).toMatch(/confirm/i)
  })

  it('says to wait when the attempt was rate limited, not that the password is wrong', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { code: 'over_request_rate_limit', message: 'Request rate limit reached' },
    })

    const state = await signIn({}, form({ email: 'a@b.co', password: 'hunter22' }))

    expect(state.message).not.toMatch(/do not match/i)
    expect(state.message).toMatch(/wait/i)
  })

  it('still refuses to say which half was wrong for a real credential failure', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })

    const state = await signIn({}, form({ email: 'a@b.co', password: 'hunter22' }))

    // Naming the wrong half would tell an attacker which addresses are
    // registered, so this one message stays deliberately incurious.
    expect(state.message).toMatch(/do not match/i)
    expect(state.message).not.toMatch(/password is/i)
  })

  it('asks for both fields before calling Supabase', async () => {
    const state = await signIn({}, form({ email: '', password: '' }))

    expect(state.message).toMatch(/email and password/i)
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })
})

describe('signing up', () => {
  it('creates the account', async () => {
    await destinationOf(signUp({}, form({ email: 'a@b.co', password: 'hunter22' })))

    expect(auth.signUp).toHaveBeenCalledWith({ email: 'a@b.co', password: 'hunter22' })
  })

  it('refuses a password under eight characters without calling Supabase', async () => {
    const state = await signUp({}, form({ email: 'a@b.co', password: 'short' }))

    expect(state.message).toMatch(/eight characters/i)
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it('tells the learner to confirm their email when no session came back', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null })

    const state = await signUp({}, form({ email: 'a@b.co', password: 'hunter22' }))

    expect(state.message).toMatch(/confirm/i)
  })

  it('reports what Supabase refused', async () => {
    auth.signUp.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    })

    const state = await signUp({}, form({ email: 'a@b.co', password: 'hunter22' }))

    expect(state.message).toContain('User already registered')
  })
})

describe('signing out', () => {
  it('ends the session and returns to sign in', async () => {
    const to = await destinationOf(signOut())

    expect(auth.signOut).toHaveBeenCalled()
    expect(to).toBe('/sign-in')
  })
})
