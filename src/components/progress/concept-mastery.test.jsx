import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ConceptMastery from './concept-mastery'
import { conceptsFixture } from '@/lib/artefact-fixtures'

describe('ConceptMastery', () => {
  it('opens on the subject as a whole, marked at its average mastery', () => {
    const { container } = render(
      <ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />,
    )

    // The heading used to sit on a tinted band. It wears the same mark its
    // concepts wear now — one mark for the subject, one per row.
    expect(container.querySelector('.grain-field, .grain-wash')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Linear algebra' })).toBeInTheDocument()

    const region = screen.getByRole('region', { name: 'Mastery' })
    expect(within(region).getByText('In progress')).toBeInTheDocument()
    expect(region.querySelector('.grain-mark')).toHaveClass('field-partial')
  })

  it('carries the same state in its grain and in its fill', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />,
    )

    const mark = () =>
      screen.getByRole('region', { name: 'Mastery' }).querySelector('.grain-mark')

    expect(mark()).toHaveClass('field-partial')
    expect(mark()).toHaveStyle({ '--grain': 'var(--grain-2)' })

    await user.click(screen.getByRole('button', { name: 'Vector spaces, mastered' }))
    expect(mark()).toHaveClass('field-settled')
    expect(mark()).toHaveStyle({ '--grain': 'var(--grain-0)' })

    await user.click(screen.getByRole('button', { name: 'Diagonalisation, untouched' }))
    expect(mark()).toHaveClass('field-unresolved')
    expect(mark()).toHaveStyle({ '--grain': 'var(--grain-3)' })
    expect(container.querySelector('.grain-field')).toBeNull()
  })

  it('lists every concept with the state it is in, in words', () => {
    render(<ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />)

    const list = screen.getByRole('list', { name: 'Concepts' })
    expect(list).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Eigenvectors/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Diagonalisation, untouched' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Vector spaces, mastered' }),
    ).toBeInTheDocument()
  })

  it('shows no bar and no percentage beside the grain', () => {
    const { container } = render(
      <ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />,
    )

    expect(container.textContent).not.toMatch(/%/)
    expect(container.querySelector('progress')).toBeNull()
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('moves the heading onto the concept the learner picks', async () => {
    const user = userEvent.setup()
    render(<ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />)

    await user.click(
      screen.getByRole('button', { name: 'Diagonalisation, untouched' }),
    )

    const region = screen.getByRole('region', { name: 'Mastery' })
    expect(region.querySelector('.grain-mark')).toHaveStyle({
      '--grain': 'var(--grain-3)',
    })
    expect(
      screen.getByRole('heading', { name: 'Diagonalisation' }),
    ).toBeInTheDocument()
  })

  /* The state a concept is in belongs to that concept. A mark on its row puts
     it there, which is the whole reason marks exist. */
  it('marks every concept row with the state that concept is in', () => {
    const { container } = render(
      <ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />,
    )

    // One per row, plus the one the heading wears.
    const marks = container.querySelectorAll('.grain-mark')
    expect(marks).toHaveLength(conceptsFixture.length + 1)
    expect([...marks].map((mark) => mark.className)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('field-settled'),
        expect.stringContaining('field-unresolved'),
        expect.stringContaining('field-partial'),
      ]),
    )
  })

  /* Every row is a button, and a button with no radius draws a square focus
     ring. See "Shape" in docs/DESIGN.md. */
  it('rounds every concept row, so no focus ring is a square', () => {
    render(<ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />)

    for (const row of screen.getAllByRole('button')) {
      expect(row).toHaveClass('rounded-control')
    }
  })

  /* Marks are decoration to a screen reader — the row already names its state
     in the accessible name and in words beside it. */
  it('hides its marks from assistive technology', () => {
    const { container } = render(
      <ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />,
    )

    for (const mark of container.querySelectorAll('.grain-mark')) {
      expect(mark).toHaveAttribute('aria-hidden', 'true')
    }
  })

  /* The band across the top of the page is what made progress read as
     furniture rather than as the subject. Nothing here paints one. */
  it('bands nothing across the page', () => {
    const { container } = render(
      <ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />,
    )

    const region = screen.getByRole('region', { name: 'Mastery' })
    expect(region.className).not.toMatch(/grain-field|grain-wash|min-h-64/)
    expect(container.querySelector('.grain-field, .grain-wash')).toBeNull()
  })

  it('lets the learner step back out to the subject', async () => {
    const user = userEvent.setup()
    render(<ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />)

    await user.click(screen.getByRole('button', { name: 'Vector spaces, mastered' }))
    await user.click(screen.getByRole('button', { name: 'Show the whole subject' }))

    expect(screen.getByRole('heading', { name: 'Linear algebra' })).toBeInTheDocument()
  })

  it('invites the learner to act when there is nothing to measure yet', () => {
    render(<ConceptMastery subject="Linear algebra" concepts={[]} />)

    expect(
      screen.getByText(
        'No concepts yet. Add material and this subject will start to clear.',
      ),
    ).toBeInTheDocument()
  })
})
