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

export async function signIn(previousState, formData) {
  const { email, password } = credentials(formData)

  if (!email || !password) {
    return { message: 'Enter your email and password to sign in.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Supabase says "Invalid login credentials" whether the account exists
    // or not, and so do we — naming which half was wrong tells an attacker
    // which emails are registered.
    return { message: 'That email and password do not match. Check both and try again.' }
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
