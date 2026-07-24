import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import AuthForm from './auth-form'

const noop = () => ({})

describe('the sign-in form', () => {
  it('labels both fields with a real label', () => {
    render(<AuthForm mode="sign-in" action={noop} />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('names the two fields so the server action can read them', () => {
    render(<AuthForm mode="sign-in" action={noop} />)

    expect(screen.getByLabelText('Email')).toHaveAttribute('name', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('name', 'password')
  })

  it('says what the button does', () => {
    render(<AuthForm mode="sign-in" action={noop} />)

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('asks the browser for the existing password, not a new one', () => {
    render(<AuthForm mode="sign-in" action={noop} />)

    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
  })

  it('carries the destination through the form', () => {
    const { container } = render(
      <AuthForm mode="sign-in" action={noop} next="/dashboard/subjects" />,
    )

    expect(container.querySelector('input[name="next"]')).toHaveValue(
      '/dashboard/subjects',
    )
  })
})

describe('the sign-up form', () => {
  it('says what its own button does', () => {
    render(<AuthForm mode="sign-up" action={noop} />)

    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  it('asks the browser for a new password', () => {
    render(<AuthForm mode="sign-up" action={noop} />)

    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
  })
})

describe('an error', () => {
  it('is announced and stated in words', () => {
    render(
      <AuthForm
        mode="sign-in"
        action={noop}
        initialState={{ message: 'That email and password do not match. Try again.' }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'That email and password do not match. Try again.',
    )
  })

  it('carries no colour, only a rule', () => {
    render(<AuthForm mode="sign-in" action={noop} initialState={{ message: 'Nope.' }} />)

    expect(screen.getByRole('alert').className).toContain('border-l-2')
    expect(screen.getByRole('alert').className).toContain('border-ink')
  })
})
