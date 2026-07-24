import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import MultipleChoiceArtefact from './multiple-choice-artefact'
import { multipleChoiceFixture } from '@/lib/artefact-fixtures'

describe('MultipleChoiceArtefact', () => {
  it('offers the options as a named set of radios', () => {
    render(<MultipleChoiceArtefact artefact={multipleChoiceFixture} />)

    expect(screen.getByRole('radiogroup', { name: 'Your answer' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'The eigenvalues of A' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
  })

  it('keeps every reason hidden until an answer is given', () => {
    render(<MultipleChoiceArtefact artefact={multipleChoiceFixture} />)

    expect(screen.queryByText(/The trace is the sum/)).not.toBeInTheDocument()
  })

  it('will not check an empty answer', () => {
    render(<MultipleChoiceArtefact artefact={multipleChoiceFixture} />)

    expect(screen.getByRole('button', { name: 'Check your answer' })).toBeDisabled()
  })

  it('states the outcome in words and gives a reason for every option', async () => {
    const user = userEvent.setup()
    render(<MultipleChoiceArtefact artefact={multipleChoiceFixture} />)

    await user.click(screen.getByRole('radio', { name: 'The rank of A' }))
    await user.click(screen.getByRole('button', { name: 'Check your answer' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Not right. The answer is "The eigenvalues of A".',
    )
    expect(screen.getByText(/Rank is the dimension of the image/)).toBeInTheDocument()
    expect(screen.getByText(/The trace is the sum/)).toBeInTheDocument()
  })

  it('says so plainly when the answer was right', async () => {
    const user = userEvent.setup()
    render(<MultipleChoiceArtefact artefact={multipleChoiceFixture} />)

    await user.click(screen.getByRole('radio', { name: 'The eigenvalues of A' }))
    await user.click(screen.getByRole('button', { name: 'Check your answer' }))

    expect(screen.getByRole('status')).toHaveTextContent('Right.')
  })

  it('tells the queue how the learner did', async () => {
    const user = userEvent.setup()
    const answered = []
    render(
      <MultipleChoiceArtefact
        artefact={multipleChoiceFixture}
        onAnswered={(result) => answered.push(result)}
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'The rank of A' }))
    await user.click(screen.getByRole('button', { name: 'Check your answer' }))

    expect(answered[0]).toMatchObject({
      artefactId: multipleChoiceFixture.id,
      correct: false,
    })
  })
})
