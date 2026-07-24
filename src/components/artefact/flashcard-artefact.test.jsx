import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import FlashcardArtefact from './flashcard-artefact'
import { flashcardFixture } from '@/lib/artefact-fixtures'

describe('FlashcardArtefact', () => {
  it('shows the front and holds the back back', () => {
    render(<FlashcardArtefact artefact={flashcardFixture} />)

    expect(screen.getByText('What is an eigenvalue?')).toBeInTheDocument()
    expect(screen.queryByText(/leaving the direction alone/)).not.toBeInTheDocument()
  })

  it('says what the button does', () => {
    render(<FlashcardArtefact artefact={flashcardFixture} />)

    expect(
      screen.getByRole('button', { name: 'Show the answer' }),
    ).toBeInTheDocument()
  })

  it('reveals the back when asked', async () => {
    const user = userEvent.setup()
    render(<FlashcardArtefact artefact={flashcardFixture} />)

    await user.click(screen.getByRole('button', { name: 'Show the answer' }))

    expect(screen.getByText(/leaving the direction alone/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Show the answer' }),
    ).not.toBeInTheDocument()
  })

  it('tells the queue the learner has answered', async () => {
    const user = userEvent.setup()
    const answered = []
    render(
      <FlashcardArtefact
        artefact={flashcardFixture}
        onAnswered={(result) => answered.push(result)}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Show the answer' }))

    expect(answered).toHaveLength(1)
    expect(answered[0]).toMatchObject({ artefactId: flashcardFixture.id })
  })
})
