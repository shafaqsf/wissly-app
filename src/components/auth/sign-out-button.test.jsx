import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// `vi.mock` is hoisted above every `const`, so the double is hoisted too.
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock('@/lib/auth/actions.js', () => ({ signOut }))

import SignOutButton from './sign-out-button'

describe('signing out', () => {
  it('is a button that says what it does', () => {
    render(<SignOutButton />)

    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('submits to the sign-out action rather than following a link', () => {
    render(<SignOutButton />)

    // A GET link would let a prefetch sign the learner out.
    expect(screen.getByRole('button', { name: 'Sign out' }).closest('form')).not.toBeNull()
  })
})
