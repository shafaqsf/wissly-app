import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ClozeArtefact from './cloze-artefact'
import { clozeFixture } from '@/lib/artefact-fixtures'

describe('ClozeArtefact', () => {
  it('gives every blank a real label rather than a placeholder', () => {
    render(<ClozeArtefact artefact={clozeFixture} />)

    expect(screen.getByLabelText('Missing word 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Missing word 2')).toBeInTheDocument()
  })

  it('says what the button does', () => {
    render(<ClozeArtefact artefact={clozeFixture} />)

    expect(
      screen.getByRole('button', { name: 'Check your answers' }),
    ).toBeInTheDocument()
  })

  it('marks a right answer in words, not in colour', async () => {
    const user = userEvent.setup()
    render(<ClozeArtefact artefact={clozeFixture} />)

    await user.type(screen.getByLabelText('Missing word 1'), 'Eigenvector')
    await user.type(screen.getByLabelText('Missing word 2'), 'eigenvalue')
    await user.click(screen.getByRole('button', { name: 'Check your answers' }))

    expect(screen.getByRole('status')).toHaveTextContent('Both blanks right')
  })

  it('shows the answer the learner missed, and where', async () => {
    const user = userEvent.setup()
    render(<ClozeArtefact artefact={clozeFixture} />)

    await user.type(screen.getByLabelText('Missing word 1'), 'eigenvector')
    await user.type(screen.getByLabelText('Missing word 2'), 'determinant')
    await user.click(screen.getByRole('button', { name: 'Check your answers' }))

    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 right')
    expect(screen.getByText('eigenvalue')).toBeInTheDocument()
  })

  it('accepts a spelling the payload allows', async () => {
    const user = userEvent.setup()
    render(<ClozeArtefact artefact={clozeFixture} />)

    await user.type(screen.getByLabelText('Missing word 1'), 'eigen vector')
    await user.type(screen.getByLabelText('Missing word 2'), ' Eigen Value ')
    await user.click(screen.getByRole('button', { name: 'Check your answers' }))

    expect(screen.getByRole('status')).toHaveTextContent('Both blanks right')
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

    await user.type(screen.getByLabelText('Missing word 1'), 'eigenvector')
    await user.type(screen.getByLabelText('Missing word 2'), 'eigenvalue')
    await user.click(screen.getByRole('button', { name: 'Check your answers' }))

    expect(answered[0]).toMatchObject({
      artefactId: clozeFixture.id,
      correct: true,
    })
  })
})
