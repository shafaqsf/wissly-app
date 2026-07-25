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

  it('paints an empty field at the partial state', () => {
    const { container } = render(
      <Panel title="Courses" grain empty="Start your first course to see it here.">
        <p>content</p>
      </Panel>,
    )

    const field = container.querySelector('.grain-field')
    expect(field).toHaveClass('field-partial')
    expect(field).toHaveStyle({ '--grain': 'var(--grain-2)' })
  })

  it('reads its empty copy in full ink once a field is under it', () => {
    // Muted ink clears 7:1 on paper and less than that on a tinted field.
    const { container } = render(
      <Panel title="Courses" grain empty="Start your first course to see it here.">
        <p>content</p>
      </Panel>,
    )

    const field = container.querySelector('.grain-field')
    expect(field.querySelector('.text-ink-muted')).toBeNull()
    expect(
      screen.getByText('Start your first course to see it here.'),
    ).toHaveClass('text-ink')
  })

  it('keeps its empty copy secondary when there is no field', () => {
    render(<Panel title="Courses" empty="Start your first course to see it here." />)

    expect(
      screen.getByText('Start your first course to see it here.'),
    ).toHaveClass('text-ink-muted')
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

  it('grains an empty state when asked, at an intensity text survives', () => {
    const { container } = render(
      <Panel title="Recent lessons" empty="Nothing yet." grain />,
    )

    const field = container.querySelector('.grain')
    expect(field).toHaveClass('grain-field')
    expect(field).toHaveStyle({ '--grain': 'var(--grain-2)' })
  })

  it('never grains a panel that has content, however it was asked', () => {
    const { container } = render(
      <Panel title="Courses" grain>
        <p>content</p>
      </Panel>,
    )

    expect(container.querySelector('.grain')).toBeNull()
  })

  it('never grains a failure — the ink rule carries that alone', () => {
    const { container } = render(
      <Panel title="Courses" empty="Nothing yet." error="It broke." grain />,
    )

    expect(container.querySelector('.grain')).toBeNull()
  })

  it('rounds its surface and clips what it holds to the same corner', () => {
    const { container } = render(<Panel title="Courses">content</Panel>)

    expect(container.firstChild).toHaveClass('rounded-surface')
    expect(container.firstChild).toHaveClass('overflow-hidden')
  })

  /* A panel that reports a state wears a mark, not a field. The mark sits in
     the header beside the title, so the state belongs to the panel rather
     than to the page it is on. */
  it('wears a state mark in its header when given one', () => {
    const { container } = render(
      <Panel title="Today" mark={{ field: 'field-partial', grain: 'var(--grain-2)', label: 'In progress' }}>
        content
      </Panel>,
    )

    const mark = container.querySelector('.grain-mark')
    expect(mark).toHaveClass('field-partial')
    expect(mark).toHaveStyle({ '--grain': 'var(--grain-2)' })
  })

  /* A mark that only exists as a colour says nothing to a screen reader, and
     nothing at all to anyone who cannot separate the three tints. */
  it('names the state the mark carries', () => {
    render(
      <Panel title="Today" mark={{ field: 'field-partial', grain: 'var(--grain-2)', label: 'In progress' }}>
        content
      </Panel>,
    )

    expect(screen.getByText('In progress')).toBeInTheDocument()
  })

  it('wears no mark when it is not given one', () => {
    const { container } = render(<Panel title="Courses">content</Panel>)

    expect(container.querySelector('.grain-mark')).toBeNull()
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

  it('takes the same rounded surface as the panel it stands in for', () => {
    const { container } = render(<PanelSkeleton title="Courses" />)

    expect(container.firstChild).toHaveClass('rounded-surface')
    expect(container.firstChild).toHaveClass('overflow-hidden')
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
