'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server.js'

const MIN_PASSWORD = 8

/**
 * Where to go after signing in. Only a path on this site is followed — an
 * absolute URL in `next` would turn the sign-in screen into an open
 * redirect, which is a phishing tool.
 */
function destination(next) {
  return typeof next === 'string' && /^\/(?!\/)/.test(next) ? next : '/dashboard'
}

function credentials(formData) {
  return {
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  }
}

/**
 * Why a sign-in failed, in the learner's terms.
 *
 * The one message this used to return was written to avoid user enumeration —
 * a good instinct, and it still governs the credential case: Supabase says
 * "Invalid login credentials" whether or not the account exists, and so do we,
 * because naming which half was wrong tells an attacker which addresses are
 * registered.
 *
 * But it was applied to *every* error, including two that are not about
 * credentials at all. An unconfirmed address answers a **correct** password
 * with `email_not_confirmed`, and telling that learner their password is wrong
 * sends them to change the one thing that works — with no way out of the loop,
 * because no number of correct passwords will ever be accepted.
 *
 * Naming the unconfirmed state does concede that the address is registered.
 * That is a real cost, and it is smaller than locking someone out of their own
 * account while lying to them about why.
 *
 * Not exported: a 'use server' module may only export async functions, because
 * every export becomes a callable server action. This is a pure helper and it
 * is reached through `signIn`, which is where the tests exercise it.
 */
function explainSignInFailure(error, email) {
  const code = error?.code ?? ''
  const message = String(error?.message ?? '')

  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return `${email} has not been confirmed yet. Open the link in the email wissly sent you, then sign in.`
  }

  if (code === 'over_request_rate_limit' || error?.status === 429) {
    return 'Too many attempts just now. Wait a minute and try again.'
  }

  return 'That email and password do not match. Check both and try again.'
}

export async function signIn(previousState, formData) {
  const { email, password } = credentials(formData)

  if (!email || !password) {
    return { message: 'Enter your email and password to sign in.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { message: explainSignInFailure(error, email) }
  }

  revalidatePath('/', 'layout')
  redirect(destination(formData.get('next')))
}

export async function signUp(previousState, formData) {
  const { email, password } = credentials(formData)

  if (!email || !password) {
    return { message: 'Enter your email and password to create an account.' }
  }

  if (password.length < MIN_PASSWORD) {
    return { message: 'Choose a password of at least eight characters.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return { message: error.message }
  }

  if (!data?.session) {
    // Email confirmation is on for this project. There is no session yet,
    // so there is nowhere to redirect to.
    return { message: `Check ${email} and confirm your address to finish signing up.` }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/sign-in')
}
