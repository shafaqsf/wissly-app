import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EmptyState from './empty-state'

describe('EmptyState', () => {
  it('draws the illustration for its variant beside the words', () => {
    const { container } = render(
      <EmptyState variant="shelf">Name your first course above.</EmptyState>,
    )

    expect(container.querySelector('svg[data-empty-illustration]')).toBeInTheDocument()
    expect(screen.getByText('Name your first course above.')).toBeInTheDocument()
  })

  /* The words are still what carries the meaning to a screen reader — the
     picture is decoration, the way the brand mark is. */
  it('hides the illustration from assistive technology', () => {
    const { container } = render(<EmptyState variant="search">Nothing matches.</EmptyState>)

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('picks a different drawing for each variant', () => {
    const { container: shelf } = render(<EmptyState variant="shelf">A</EmptyState>)
    const { container: search } = render(<EmptyState variant="search">B</EmptyState>)

    expect(shelf.querySelector('svg').innerHTML).not.toBe(search.querySelector('svg').innerHTML)
  })

  it('keeps the empty copy secondary, as every other empty state does', () => {
    render(<EmptyState variant="tasks">Nothing yet.</EmptyState>)

    expect(screen.getByText('Nothing yet.')).toHaveClass('text-ink-muted')
  })

  it('renders an action beside the words when it is given one', () => {
    render(
      <EmptyState variant="queue" action={<button type="button">Write one</button>}>
        Nothing due.
      </EmptyState>,
    )

    expect(screen.getByRole('button', { name: 'Write one' })).toBeInTheDocument()
  })
})
