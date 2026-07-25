import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ConceptMastery from './concept-mastery'
import { conceptsFixture } from '@/lib/artefact-fixtures'

describe('ConceptMastery', () => {
  it('opens on the subject as a whole, grained at its average mastery', () => {
    const { container } = render(
      <ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />,
    )

    const fields = container.querySelectorAll('.grain-field')
    // One field *surface* per viewport. This is it; the row marks are marks.
    expect(fields).toHaveLength(1)
    expect(fields[0]).toHaveStyle({ '--grain': 'var(--grain-2)' })
    expect(screen.getByRole('heading', { name: 'Linear algebra' })).toBeInTheDocument()
    const field = screen.getByRole('region', { name: 'Mastery' })
    expect(within(field).getByText('In progress')).toBeInTheDocument()
  })

  it('carries the same state in its grain and in its colour', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />,
    )

    const field = () => container.querySelector('.grain-field')

    expect(field()).toHaveClass('field-partial')
    expect(field()).toHaveStyle({ '--grain': 'var(--grain-2)' })

    await user.click(screen.getByRole('button', { name: 'Vector spaces, mastered' }))
    expect(field()).toHaveClass('field-settled')
    expect(field()).toHaveStyle({ '--grain': 'var(--grain-0)' })

    await user.click(screen.getByRole('button', { name: 'Diagonalisation, untouched' }))
    expect(field()).toHaveClass('field-unresolved')
    expect(field()).toHaveStyle({ '--grain': 'var(--grain-3)' })
  })

  it('reads its state label in full ink, since it sits on a field', () => {
    const { container } = render(
      <ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />,
    )

    expect(container.querySelector('.grain-field .text-ink-muted')).toBeNull()
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

  it('moves the one field onto the concept the learner picks', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Diagonalisation, untouched' }),
    )

    const fields = container.querySelectorAll('.grain-field')
    expect(fields).toHaveLength(1)
    expect(fields[0]).toHaveStyle({ '--grain': 'var(--grain-3)' })
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

    const marks = container.querySelectorAll('.grain-mark')
    expect(marks).toHaveLength(conceptsFixture.length)
    expect([...marks].map((mark) => mark.className)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('field-settled'),
        expect.stringContaining('field-unresolved'),
        expect.stringContaining('field-partial'),
      ]),
    )
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

  it('rounds the field surface rather than banding the page', () => {
    const { container } = render(
      <ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />,
    )

    const field = container.querySelector('.grain-field')
    expect(field).toHaveClass('rounded-surface')
    expect(field).not.toHaveClass('min-h-64')
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
