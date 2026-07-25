import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import Sidebar from './sidebar'

describe('the sidebar', () => {
  it('links its brand row back to the dashboard', () => {
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: 'wissly' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })

  /* The mark is the product's identity, so it sits in the frame rather than on
     any one page. It is decorative: the word "wissly" is right beside it. */
  it('wears the brand mark beside the wordmark', () => {
    const { container } = render(<Sidebar />)

    const marks = container.querySelectorAll('[data-brand-mark]')
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveAttribute('alt', '')
  })

  /* Collapsed, the word is the thing that goes. The mark is what a 64px rail
     has room for, and it is what makes the rail recognisable at all. */
  it('keeps the mark when the rail collapses and the word does not fit', () => {
    const { container } = render(<Sidebar collapsed />)

    expect(container.querySelectorAll('[data-brand-mark]')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'wissly' }).className).toMatch(
      /md:sr-only/,
    )
  })
})
