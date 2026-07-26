import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import ReviewQueue from './review-queue'
import { FORMAT_NAMES } from '@/components/task/task-types'
import { clozeFixture, flashcardFixture } from '@/lib/artefact-fixtures'

const two = [flashcardFixture, clozeFixture]

async function answerTheFlashcard(user) {
  await user.click(screen.getByRole('button', { name: 'Show the answer' }))
}

describe('ReviewQueue', () => {
  it('invites the learner to act when nothing is due', () => {
    const { container } = render(<ReviewQueue artefacts={[]} />)

    expect(
      screen.getByText(
        'Nothing is due right now. Write a card yourself, or generate some from your material.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Write your first card' })).toHaveAttribute(
      'href',
      '/tasks/flashcards',
    )

    // A card sized to its message, not a tinted band across the page.
    expect(container.querySelector('.grain, .grain-field')).toBeNull()
    expect(container.firstChild).toHaveClass('rounded-surface', 'border', 'border-rule')

    // task item 7 in v0.15: an illustration beside the invitation.
    expect(container.querySelector('svg[data-empty-illustration]')).toBeInTheDocument()
  })

  it('shows one task at a time, and says where you are', () => {
    render(<ReviewQueue artefacts={two} />)

    expect(screen.getByText('1 of 2 due')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: FORMAT_NAMES.flashcard })).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: FORMAT_NAMES.cloze }),
    ).not.toBeInTheDocument()
  })

  it('holds the rating back until the task has been answered', () => {
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
    expect(screen.getByRole('button', { name: /Not at all/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /With effort/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Comfortably/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Instantly/ })).toBeInTheDocument()
  })

  it('reports the rating as a 1 to 4 grade against the task', async () => {
    const user = userEvent.setup()
    const rated = []
    render(<ReviewQueue artefacts={two} onRate={(entry) => rated.push(entry)} />)

    await answerTheFlashcard(user)
    await user.click(screen.getByRole('button', { name: /With effort/ }))

    expect(rated).toEqual([
      expect.objectContaining({ artefactId: flashcardFixture.id, rating: 2 }),
    ])
  })

  it('moves to the next task after a rating', async () => {
    const user = userEvent.setup()
    render(<ReviewQueue artefacts={two} />)

    await answerTheFlashcard(user)
    await user.click(screen.getByRole('button', { name: /Comfortably/ }))

    expect(screen.getByText('2 of 2 due')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: FORMAT_NAMES.cloze })).toBeInTheDocument()
  })

  it('closes the queue when the last task has been rated', async () => {
    const user = userEvent.setup()
    render(<ReviewQueue artefacts={[flashcardFixture]} />)

    await answerTheFlashcard(user)
    await user.click(screen.getByRole('button', { name: /Instantly/ }))

    expect(screen.getByText('That is today done. You reviewed 1 task.')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /recall/i })).not.toBeInTheDocument()
  })

  it('keeps every rating button at the 44px floor', async () => {
    const user = userEvent.setup()
    render(<ReviewQueue artefacts={two} />)
    await answerTheFlashcard(user)

    for (const name of [/Not at all/, /With effort/, /Comfortably/, /Instantly/]) {
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-11')
    }
  })

  /* A daily surface that needs a mouse does not get used daily. */
  describe('the keyboard runs the round', () => {
    it('says which keys do what', () => {
      render(<ReviewQueue artefacts={two} />)

      expect(screen.getByText(/Space turns the card/)).toBeInTheDocument()
    })

    it('turns the card on Space', async () => {
      const user = userEvent.setup()
      render(<ReviewQueue artefacts={two} />)

      await user.keyboard('[Space]')

      expect(screen.getByText('Answer')).toBeInTheDocument()
      expect(
        screen.getByRole('group', { name: 'How well did you recall that?' }),
      ).toBeInTheDocument()
    })

    it('turns the card on Enter too, so one hand can run the round', async () => {
      const user = userEvent.setup()
      render(<ReviewQueue artefacts={two} />)

      await user.keyboard('{Enter}')

      expect(screen.getByText('Answer')).toBeInTheDocument()
    })

    it('rates the turned card on 1 to 4 and moves on', async () => {
      const user = userEvent.setup()
      const rated = []
      render(<ReviewQueue artefacts={two} onRate={(entry) => rated.push(entry)} />)

      await user.keyboard('[Space]')
      await user.keyboard('4')

      expect(rated).toEqual([
        expect.objectContaining({ artefactId: flashcardFixture.id, rating: 4 }),
      ])
      expect(screen.getByText('2 of 2 due')).toBeInTheDocument()
    })

    it('will not rate a card that has not been answered', async () => {
      const user = userEvent.setup()
      const rated = []
      render(<ReviewQueue artefacts={two} onRate={(entry) => rated.push(entry)} />)

      await user.keyboard('3')

      expect(rated).toEqual([])
      expect(screen.getByText('1 of 2 due')).toBeInTheDocument()
    })

    it('leaves the keys alone while the learner is typing an answer', async () => {
      const user = userEvent.setup()
      const rated = []
      render(<ReviewQueue artefacts={[clozeFixture]} onRate={(entry) => rated.push(entry)} />)

      await user.click(screen.getByLabelText('The missing word'))
      await user.keyboard('3')

      expect(rated).toEqual([])
      expect(screen.getByLabelText('The missing word')).toHaveValue('3')
    })
  })
})
