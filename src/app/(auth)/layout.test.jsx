import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import AuthLayout from './layout'

describe('the auth frame', () => {
  it('keeps the form on clean paper', () => {
    const { container } = render(
      <AuthLayout>
        <form aria-label="Sign in">
          <button type="submit">Sign in</button>
        </form>
      </AuthLayout>,
    )

    // docs/DESIGN.md: a field sits beside a form, never behind it. Nothing
    // between the form and the page may carry one.
    let node = screen.getByRole('form', { name: 'Sign in' })
    while (node && node !== container) {
      expect(node.className).not.toMatch(/grain-field/)
      node = node.parentElement
    }
  })

  it('shows the field above the form, as its own element', () => {
    const { container } = render(
      <AuthLayout>
        <p>Sign in</p>
      </AuthLayout>,
    )

    const field = container.querySelector('.grain-field')

    expect(field).not.toBeNull()
    expect(field.className).toMatch(/field-unresolved/)
    expect(field).toBeEmptyDOMElement()
    expect(field).toHaveStyle({ '--grain': 'var(--grain-3)' })
  })

  /* It used to take half the viewport. A field that fills half a screen is
     describing the screen, and the screen does not have a state — see
     "Where a field goes" in docs/DESIGN.md. */
  it('sizes the field to the reading column, not to the viewport', () => {
    const { container } = render(
      <AuthLayout>
        <p>Sign in</p>
      </AuthLayout>,
    )

    const field = container.querySelector('.grain-field')

    expect(field).toHaveClass('rounded-surface')
    expect(field.className).not.toMatch(/flex-1|min-h-full|md:order-last/)
  })

  it('hides the field from assistive technology', () => {
    const { container } = render(
      <AuthLayout>
        <p>Sign in</p>
      </AuthLayout>,
    )

    // It carries no words, and the state it encodes — signed out — is already
    // obvious from the page you are on.
    expect(container.querySelector('.grain-field')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })
})
