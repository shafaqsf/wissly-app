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

    const fields = container.querySelectorAll('.grain')
    // One grain field per viewport. This is it.
    expect(fields).toHaveLength(1)
    expect(fields[0]).toHaveStyle({ '--grain': 'var(--grain-2)' })
    expect(screen.getByRole('heading', { name: 'Linear algebra' })).toBeInTheDocument()
    const field = screen.getByRole('region', { name: 'Mastery' })
    expect(within(field).getByText('In progress')).toBeInTheDocument()
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

    const fields = container.querySelectorAll('.grain')
    expect(fields).toHaveLength(1)
    expect(fields[0]).toHaveStyle({ '--grain': 'var(--grain-3)' })
    expect(
      screen.getByRole('heading', { name: 'Diagonalisation' }),
    ).toBeInTheDocument()
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
