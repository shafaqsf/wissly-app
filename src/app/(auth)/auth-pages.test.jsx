import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// The screens only wire the actions up; what the actions do is covered in
// src/lib/auth/actions.test.js, and importing the real ones would drag
// `next/navigation` into jsdom.
vi.mock('@/lib/auth/actions.js', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}))

import SignInPage from './sign-in/page'
import SignUpPage from './sign-up/page'

describe('the sign-in screen', () => {
  it('says what it is', async () => {
    render(await SignInPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sign in')
  })

  it('offers the way to sign up instead', async () => {
    render(await SignInPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('link', { name: /create one/i })).toHaveAttribute(
      'href',
      '/sign-up',
    )
  })

  it('keeps the destination the proxy recorded', async () => {
    const { container } = render(
      await SignInPage({ searchParams: Promise.resolve({ next: '/dashboard/subjects' }) }),
    )

    expect(container.querySelector('input[name="next"]')).toHaveValue(
      '/dashboard/subjects',
    )
  })
})

describe('the sign-up screen', () => {
  it('says what it is', async () => {
    render(await SignUpPage())

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Create your account')
  })

  it('offers the way back to signing in', async () => {
    render(await SignUpPage())

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/sign-in',
    )
  })
})
