import { render, screen, within } from '@testing-library/react'
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
     radius draws a square ring in an interface that has none. */
  it('rounds the wordmark so its focus ring is not a square', () => {
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: 'wissly' })).toHaveClass(
      'rounded-control',
    )
  })

  /* This assertion used to require exactly one mark here, because the product
     names itself once per viewport and the frame was the only thing that could
     carry it. The agent bar carries it now, so a mark in the rail would be the
     second one on the screen. */
  it('wears no brand mark, because the agent bar is the one that does', () => {
    const { container } = render(<Sidebar />)

    expect(container.querySelectorAll('[data-brand-mark]')).toHaveLength(0)
  })

  it('wears no brand mark collapsed either', () => {
    const { container } = render(<Sidebar collapsed />)

    expect(container.querySelectorAll('[data-brand-mark]')).toHaveLength(0)
  })

  /* Four areas, each answering a question no other one answers. `Review` is
     `/tasks/due` now and `Library` dissolved into the course page. */
  it('offers the four areas, in order, and nothing else in the main list', () => {
    render(<Sidebar />)

    const nav = screen.getByRole('navigation', { name: 'Main' })
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent)

    expect(labels).toEqual(['Dashboard', 'Courses', 'Tasks', 'Analytics'])
  })

  it('has no Review and no Library destination left', () => {
    render(<Sidebar />)

    expect(screen.queryByRole('link', { name: 'Review' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Library' })).toBeNull()
  })

  /* Settings is not a fifth area. It is the account, so it sits in the foot,
     separated by a hairline rather than by a gap. */
  it('puts Settings in the foot, under a hairline, outside the main list', () => {
    render(<Sidebar />)

    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).queryByRole('link', { name: 'Settings' })).toBeNull()

    const foot = screen.getByRole('navigation', { name: 'Account' })
    const settings = within(foot).getByRole('link', { name: 'Settings' })
    expect(settings).toHaveAttribute('href', '/settings')
    expect(foot.className).toMatch(/border-t/)
    expect(foot.className).toMatch(/mt-auto/)
  })

  it('keeps Settings and its 44px tap target when the rail collapses', () => {
    render(<Sidebar collapsed />)

    const foot = screen.getByRole('navigation', { name: 'Account' })
    const settings = within(foot).getByRole('link', { name: 'Settings' })
    expect(settings.className).toMatch(/min-h-11/)
  })

  /* Nothing in the rail is a logo any more, so the nav is what makes it
     recognisable: every destination keeps its name on hover and to assistive
     technology at 64px. */
  it('keeps every destination named when collapsed to a 64px rail', () => {
    render(<Sidebar collapsed />)

    for (const label of [
      'Dashboard',
      'Courses',
      'Tasks',
      'Analytics',
      'Settings',
    ]) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'title',
        label,
      )
    }
  })

  /* A 64px rail minus its padding is 40px of room. The toggle is a 44px tap
     target, so collapsed the row gives up its side padding and centres the one
     control it still holds. */
  it('keeps the collapsed rail openable', () => {
    const { container } = render(<Sidebar collapsed />)

    const brandRow = container.querySelector('[data-brand-row]')
    const toggle = screen.getByRole('button', { name: 'Expand sidebar' })

    expect(brandRow.contains(toggle)).toBe(true)
    expect(toggle.className).toMatch(/size-11/)
    expect(brandRow.className).toMatch(/md:px-0/)
  })
})
