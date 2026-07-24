import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ClozeArtefact from './cloze-artefact'
import { CLOZE_BLANK } from '@/lib/agent/formats'
import { clozeFixture } from '@/lib/artefact-fixtures'

describe('ClozeArtefact', () => {
  it('gives the blank a real label rather than a placeholder', () => {
    render(<ClozeArtefact artefact={clozeFixture} />)

    expect(screen.getByLabelText('The missing word')).toBeInTheDocument()
  })

  it('puts the field where the marker was, and prints no underscores', () => {
    const { container } = render(<ClozeArtefact artefact={clozeFixture} />)

    expect(container.textContent).not.toContain(CLOZE_BLANK)
    expect(screen.getByText(/is called an/)).toBeInTheDocument()
  })

  it('will not check an empty blank', () => {
    render(<ClozeArtefact artefact={clozeFixture} />)

    expect(screen.getByRole('button', { name: 'Check your answer' })).toBeDisabled()
  })

  it('marks a right answer in words, not in colour, ignoring case', async () => {
    const user = userEvent.setup()
    render(<ClozeArtefact artefact={clozeFixture} />)

    await user.type(screen.getByLabelText('The missing word'), 'Eigenvector ')
    await user.click(screen.getByRole('button', { name: 'Check your answer' }))

    expect(screen.getByRole('status')).toHaveTextContent('Right.')
  })

  it('gives the word back when the learner missed it', async () => {
    const user = userEvent.setup()
    render(<ClozeArtefact artefact={clozeFixture} />)

    await user.type(screen.getByLabelText('The missing word'), 'determinant')
    await user.click(screen.getByRole('button', { name: 'Check your answer' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Not right. The word is "eigenvector".',
    )
    expect(
      screen.getByRole('button', { name: 'Source 1, page 12' }),
    ).toBeInTheDocument()
  })

  it('tells the queue how the learner did', async () => {
    const user = userEvent.setup()
    const answered = []
    render(
      <ClozeArtefact
        artefact={clozeFixture}
        onAnswered={(result) => answered.push(result)}
      />,
    )

    await user.type(screen.getByLabelText('The missing word'), 'eigenvector')
    await user.click(screen.getByRole('button', { name: 'Check your answer' }))

    expect(answered[0]).toMatchObject({
      artefactId: clozeFixture.id,
      correct: true,
    })
  })
})
