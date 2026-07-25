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

  /* The card used to be tinted, on the grounds that a page that is not there
     is an empty state. It was a grey box behind a heading that already says
     the whole thing. It is a bordered card now, and nothing else. */
  it('paints no background behind the heading', () => {
    const { container } = render(<NotFound />)

    expect(container.querySelector('.grain-field, .grain-wash, .grain')).toBeNull()

    const card = screen.getByRole('heading', { level: 1 }).parentElement
    expect(card).toHaveClass('rounded-surface', 'border', 'border-rule')
    expect(card).not.toBe(container.firstChild)
  })

  /* There is no sidebar out here, so nothing else on the page says which
     product this is. */
  it('stands the brand mark in the card, where no frame carries it', () => {
    const { container } = render(<NotFound />)

    const marks = container.querySelectorAll('[data-brand-mark]')
    expect(marks).toHaveLength(1)

    const card = screen.getByRole('heading', { level: 1 }).parentElement
    expect(card.contains(marks[0])).toBe(true)
  })

  it('offers the way back that a learner actually wants', () => {
    render(<NotFound />)

    expect(screen.getByRole('link', { name: 'Go to your dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })
})
