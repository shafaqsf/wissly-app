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

  /* An empty panel used to take a tinted surface, on the grounds that a
     surface with nothing on it is unresolved. It was a grey rectangle under a
     sentence. A panel whose emptiness is a
     state worth showing wears a `mark` in its header, like every other state. */
  it('paints nothing behind an empty panel', () => {
    const { container } = render(
      <Panel title="Courses" empty="Start your first course to see it here.">
        <p>content</p>
      </Panel>,
    )

    expect(container.querySelector('.grain, .grain-field, .grain-wash')).toBeNull()
  })

  it('keeps its empty copy secondary, because that is what it is', () => {
    render(<Panel title="Courses" empty="Start your first course to see it here." />)

    expect(
      screen.getByText('Start your first course to see it here.'),
    ).toHaveClass('text-ink-muted')
  })

  /* task item 7 in v0.15: an empty panel is allowed an illustration now, so
     `empty` accepts an element as well as a sentence — composed as given,
     rather than nested inside a second paragraph. */
  it('renders an illustrated empty state as given, rather than wrapping it again', () => {
    render(
      <Panel
        title="Courses"
        empty={
          <div data-testid="illustrated-empty">
            <p className="text-body-s text-ink-muted">Start your first course.</p>
          </div>
        }
      >
        <p>content</p>
      </Panel>,
    )

    expect(screen.getByTestId('illustrated-empty')).toBeInTheDocument()
    expect(screen.getByText('Start your first course.')).toBeInTheDocument()
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

  /* The rule goes on the message, not on the frame. A 2px side against the
     panel's 1px hairline mitres across a 14px corner, and the panel visibly
     stopped being round at the two ends of the rule. Every other failure in
     the product already rules its own paragraph — the auth form, the agent
     transcript — so this is also the shape they all share now. */
  it('rules the message rather than mitring the panel corner', () => {
    const { container } = render(<Panel title="Courses" error="It broke." />)

    expect(container.querySelector('[data-state="error"]').className).not.toMatch(
      /border-l-2/,
    )
    expect(screen.getByRole('alert')).toHaveClass('border-l-2', 'border-l-ink')
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

  /* The only grain a panel carries is the mark in its header. Nothing behind
     the content, in any of its three states. */
  it.each([
    ['content', { children: 'content' }],
    ['empty', { empty: 'Nothing yet.' }],
    ['failed', { empty: 'Nothing yet.', error: 'It broke.' }],
  ])('paints no background when it is %s', (_state, props) => {
    const { container } = render(<Panel title="Courses" {...props} />)

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

  /* The body used to be a grey wash. Several panels load at once, so several
     grey slabs appeared at once — the loudest thing a screen can do to say
     "not yet". The bars say it, and `aria-busy` says it to everyone else. */
  it('paints no wash behind its bars', () => {
    const { container } = render(<PanelSkeleton title="Courses" />)

    expect(container.querySelector('.grain, .grain-wash, .grain-field')).toBeNull()
    expect(container.querySelectorAll('.rounded-round.bg-rule')).toHaveLength(3)
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
