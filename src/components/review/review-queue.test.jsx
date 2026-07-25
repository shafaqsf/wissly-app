import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ReviewQueue from './review-queue'
import { FORMAT_NAMES } from '@/components/artefact/artefact'
import { flashcardFixture, clozeFixture } from '@/lib/artefact-fixtures'

const two = [flashcardFixture, clozeFixture]

async function answerTheFlashcard(user) {
  await user.click(screen.getByRole('button', { name: 'Show the answer' }))
}

describe('ReviewQueue', () => {
  it('invites the learner to act when nothing is due', () => {
    const { container } = render(<ReviewQueue artefacts={[]} />)

    expect(
      screen.getByText(
        'Nothing is due right now. Add material and the first review will appear here.',
      ),
    ).toBeInTheDocument()

    const field = container.querySelector('.grain')
    expect(field).toHaveClass('grain-field')
    // A card sized to its message, not a full-width band across the page.
    expect(field).toHaveClass('rounded-surface')
    expect(field).not.toHaveClass('min-h-64')
  })

  it('shows one artefact at a time, and says where you are', () => {
    render(<ReviewQueue artefacts={two} />)

    expect(screen.getByText('1 of 2 due')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: FORMAT_NAMES.flashcard })).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: FORMAT_NAMES.cloze }),
    ).not.toBeInTheDocument()
  })

  it('holds the rating back until the artefact has been answered', () => {
    render(<ReviewQueue artefacts={two} />)

    expect(screen.queryByRole('group', { name: /recall/i })).not.toBeInTheDocument()
  })

  it('asks for a rating once the answer is out, in words not numbers', async () => {
    const user = userEvent.setup()
    render(<ReviewQueue artefacts={two} />)
    await answerTheFlashcard(user)

    expect(
      screen.getByRole('group', { name: 'How well did you recall that?' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not at all' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'With effort' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comfortably' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Instantly' })).toBeInTheDocument()
  })

  it('reports the rating as a 1 to 4 grade against the artefact', async () => {
    const user = userEvent.setup()
    const rated = []
    render(<ReviewQueue artefacts={two} onRate={(entry) => rated.push(entry)} />)

    await answerTheFlashcard(user)
    await user.click(screen.getByRole('button', { name: 'With effort' }))

    expect(rated).toEqual([
      expect.objectContaining({ artefactId: flashcardFixture.id, rating: 2 }),
    ])
  })

  it('moves to the next artefact after a rating', async () => {
    const user = userEvent.setup()
    render(<ReviewQueue artefacts={two} />)

    await answerTheFlashcard(user)
    await user.click(screen.getByRole('button', { name: 'Comfortably' }))

    expect(screen.getByText('2 of 2 due')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: FORMAT_NAMES.cloze })).toBeInTheDocument()
  })

  it('closes the queue when the last artefact has been rated', async () => {
    const user = userEvent.setup()
    render(<ReviewQueue artefacts={[flashcardFixture]} />)

    await answerTheFlashcard(user)
    await user.click(screen.getByRole('button', { name: 'Instantly' }))

    expect(
      screen.getByText('That is today done. You reviewed 1 artefact.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /recall/i })).not.toBeInTheDocument()
  })

  it('keeps every rating button at the 44px floor', async () => {
    const user = userEvent.setup()
    render(<ReviewQueue artefacts={two} />)
    await answerTheFlashcard(user)

    for (const name of ['Not at all', 'With effort', 'Comfortably', 'Instantly']) {
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-11')
    }
  })
})
