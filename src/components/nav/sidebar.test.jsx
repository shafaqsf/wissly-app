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

  /* A focus outline follows the element's own corner, so a control with no
     radius draws a square ring in an interface that has none — see "Shape" in
     docs/DESIGN.md. */
  it('rounds the wordmark so its focus ring is not a square', () => {
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: 'wissly' })).toHaveClass(
      'rounded-control',
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

  /* A 64px rail minus its padding is 40px of room. A 24px mark and a 44px tap
     target do not fit on one line inside that, and side by side they pushed the
     mark off the left edge of the screen and the toggle out over the page —
     which is what made the rail impossible to open again. Collapsed, the row
     becomes a column, and each of the two gets the full width to itself. */
  it('stacks the mark above the toggle so the collapsed rail can be reopened', () => {
    const { container } = render(<Sidebar collapsed />)

    const brandRow = container.querySelector('[data-brand-row]')
    expect(brandRow.className).toMatch(/md:flex-col/)

    const toggle = screen.getByRole('button', { name: 'Expand sidebar' })
    expect(brandRow.contains(toggle)).toBe(true)
    // 44px is the tap target floor and it stays. The rail gives up its side
    // padding instead, so the target has the full 64px to sit in.
    expect(toggle.className).toMatch(/size-11/)
    expect(brandRow.className).toMatch(/md:px-0/)
  })
})
