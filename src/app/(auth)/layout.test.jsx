import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import AuthLayout from './layout'

describe('the auth frame', () => {
  /* There was a tinted band above the form, encoding "signed out". It was a
     grey box on a page already titled "Sign in". Nothing on this screen paints
     a background now. */
  it('paints nothing behind the column', () => {
    const { container } = render(
      <AuthLayout>
        <form aria-label="Sign in">
          <button type="submit">Sign in</button>
        </form>
      </AuthLayout>,
    )

    expect(container.querySelector('.grain-field, .grain-wash')).toBeNull()
    expect(container.querySelector('.grain')).toBeNull()
  })

  /* There is no sidebar out here to say which product this is. */
  it('stands the brand mark above the column', () => {
    const { container } = render(
      <AuthLayout>
        <p>Sign in</p>
      </AuthLayout>,
    )

    const marks = container.querySelectorAll('[data-brand-mark]')
    expect(marks).toHaveLength(1)
    // Decorative: the words below name the product too.
    expect(marks[0].closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('keeps the column at a reading width rather than filling the screen', () => {
    const { container } = render(
      <AuthLayout>
        <p>Sign in</p>
      </AuthLayout>,
    )

    const column = container.querySelector('.mx-auto')
    expect(column.className).toMatch(/max-w-\[42ch\]/)
  })
})
