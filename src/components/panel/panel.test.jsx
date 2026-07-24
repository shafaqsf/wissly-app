import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Panel from './panel'
import PanelGrid from './panel-grid'
import PanelSkeleton from './panel-skeleton'

describe('Panel', () => {
  it('renders its content under a heading', () => {
    render(
      <Panel title="Courses">
        <p>Three courses in progress.</p>
      </Panel>,
    )

    expect(
      screen.getByRole('heading', { level: 2, name: 'Courses' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Three courses in progress.')).toBeInTheDocument()
  })

  it('exposes itself as a region named after its title', () => {
    render(<Panel title="Courses">content</Panel>)

    expect(screen.getByRole('region', { name: 'Courses' })).toBeInTheDocument()
  })

  it('renders an action beside the title', () => {
    render(
      <Panel title="Courses" action={<button type="button">Add course</button>}>
        content
      </Panel>,
    )

    expect(
      screen.getByRole('button', { name: 'Add course' }),
    ).toBeInTheDocument()
  })

  it('invites the reader to act when it is empty, and hides the content', () => {
    render(
      <Panel title="Courses" empty="Start your first course to see it here.">
        <p>content</p>
      </Panel>,
    )

    expect(
      screen.getByText('Start your first course to see it here.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('states what went wrong and what to do next, without colour', () => {
    const { container } = render(
      <Panel
        title="Courses"
        error="Courses did not load. Check your connection and try again."
      >
        <p>content</p>
      </Panel>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Courses did not load. Check your connection and try again.',
    )
    expect(screen.queryByText('content')).not.toBeInTheDocument()
    expect(container.querySelector('[data-state="error"]')).toBeInTheDocument()
  })

  it('prefers the error over the empty state when both are given', () => {
    render(<Panel title="Courses" empty="Nothing yet." error="It broke." />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Nothing yet.')).not.toBeInTheDocument()
  })

  it('spans two columns when it is wide', () => {
    const { container } = render(
      <Panel title="Progress" wide>
        content
      </Panel>,
    )

    expect(container.firstChild).toHaveClass('md:col-span-2')
  })

  it('carries no grain, so noise stays reserved for unresolved state', () => {
    const { container } = render(<Panel title="Courses">content</Panel>)

    expect(container.querySelector('.grain')).toBeNull()
  })
})

describe('PanelSkeleton', () => {
  it('announces itself as busy while the data is still unresolved', () => {
    render(<PanelSkeleton title="Courses" />)

    const region = screen.getByRole('region', { name: 'Courses' })
    expect(region).toHaveAttribute('aria-busy', 'true')
  })

  it('grains at the unresolved intensity', () => {
    const { container } = render(<PanelSkeleton title="Courses" />)

    const grained = container.querySelector('.grain')
    expect(grained).not.toBeNull()
    expect(grained).toHaveStyle({ '--grain': 'var(--grain-3)' })
  })
})

describe('PanelGrid', () => {
  it('lays its panels out in a single column that widens with the viewport', () => {
    const { container } = render(
      <PanelGrid>
        <Panel title="Courses">content</Panel>
      </PanelGrid>,
    )

    expect(container.firstChild).toHaveClass('grid')
    expect(container.firstChild).toHaveClass('md:grid-cols-2')
    expect(container.firstChild).toHaveClass('xl:grid-cols-3')
  })
})
