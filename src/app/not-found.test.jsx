import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import NotFound from './not-found'

describe('a URL that is not a page', () => {
  it('says what happened rather than showing an empty screen', () => {
    render(<NotFound />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'This page is not here',
    )
  })

  /* The whole viewport used to be the field, and it carried no --grain at all
     — so it rendered at the ambient intensity while its own comment claimed
     otherwise. It is now a card around the heading, at the intensity its state
     class calls for, with the body copy on clean paper beside it. */
  it('states the state it paints, and paints only the heading', () => {
    const { container } = render(<NotFound />)

    const field = container.querySelector('.grain-field')
    expect(field).toHaveClass('field-unresolved')
    expect(field).toHaveStyle({ '--grain': 'var(--grain-3)' })
    expect(field).toHaveClass('rounded-surface')
    expect(field).not.toBe(container.firstChild)
  })

  /* There is no sidebar out here, so nothing else on the page says which
     product this is. */
  it('stands the brand mark in the field, where no frame carries it', () => {
    const { container } = render(<NotFound />)

    const marks = container.querySelectorAll('[data-brand-mark]')
    expect(marks).toHaveLength(1)
    expect(container.querySelector('.grain-field').contains(marks[0])).toBe(true)
  })

  it('keeps muted ink off the field', () => {
    const { container } = render(<NotFound />)

    expect(container.querySelector('.grain-field .text-ink-muted')).toBeNull()
  })

  it('offers the way back that a learner actually wants', () => {
    render(<NotFound />)

    expect(screen.getByRole('link', { name: 'Go to your dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })
})
