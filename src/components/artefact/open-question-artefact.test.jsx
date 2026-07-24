import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import OpenQuestionArtefact from './open-question-artefact'
import { openQuestionFixture } from '@/lib/artefact-fixtures'

const grade = async () => openQuestionFixture.payload.sampleFeedback

describe('OpenQuestionArtefact', () => {
  it('asks the question and gives the answer field a real label', () => {
    render(<OpenQuestionArtefact artefact={openQuestionFixture} onGrade={grade} />)

    expect(screen.getByText(/Explain what it means/)).toBeInTheDocument()
    expect(screen.getByLabelText('Your answer')).toBeInTheDocument()
  })

  it('will not send an empty answer', () => {
    render(<OpenQuestionArtefact artefact={openQuestionFixture} onGrade={grade} />)

    expect(screen.getByRole('button', { name: 'Send your answer' })).toBeDisabled()
  })

  it('grains while the agent marks the answer, and settles when it is done', async () => {
    const user = userEvent.setup()
    let release
    const slow = () =>
      new Promise((resolve) => {
        release = () => resolve(openQuestionFixture.payload.sampleFeedback)
      })

    const { container } = render(
      <OpenQuestionArtefact artefact={openQuestionFixture} onGrade={slow} />,
    )

    await user.type(screen.getByLabelText('Your answer'), 'It keeps its direction.')
    await user.click(screen.getByRole('button', { name: 'Send your answer' }))

    const field = container.querySelector('.grain')
    expect(field).toHaveClass('grain-working')
    expect(field).toHaveStyle({ '--grain': 'var(--grain-3)' })
    expect(screen.getByText('Marking your answer')).toBeInTheDocument()

    await release()
    expect(await screen.findByText(/The non-zero condition is missing/)).toBeInTheDocument()
    expect(container.querySelector('.grain-working')).toBeNull()
  })

  it('reports what the answer covered and what it missed', async () => {
    const user = userEvent.setup()
    render(<OpenQuestionArtefact artefact={openQuestionFixture} onGrade={grade} />)

    await user.type(screen.getByLabelText('Your answer'), 'It keeps its direction.')
    await user.click(screen.getByRole('button', { name: 'Send your answer' }))

    expect(
      await screen.findByText('The eigenvalue is the factor it is scaled by'),
    ).toBeInTheDocument()
    expect(screen.getByText('The vector must be non-zero')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Still missing' })).toBeInTheDocument()
  })

  it('says what happened when the marking fails, and what to do next', async () => {
    const user = userEvent.setup()
    render(
      <OpenQuestionArtefact
        artefact={openQuestionFixture}
        onGrade={async () => {
          throw new Error('offline')
        }}
      />,
    )

    await user.type(screen.getByLabelText('Your answer'), 'It keeps its direction.')
    await user.click(screen.getByRole('button', { name: 'Send your answer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your answer was not marked. Check your connection and send it again.',
    )
  })
})
