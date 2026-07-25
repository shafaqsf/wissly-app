import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import OpenQuestionArtefact from './open-question-artefact'
import { openQuestionFixture, sampleGrade } from '@/lib/artefact-fixtures'

const grade = async () => sampleGrade

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
        release = () => resolve(sampleGrade)
      })

    const { container } = render(
      <OpenQuestionArtefact artefact={openQuestionFixture} onGrade={slow} />,
    )

    await user.type(screen.getByLabelText('Your answer'), 'It keeps its direction.')
    await user.click(screen.getByRole('button', { name: 'Send your answer' }))

    // A mark beside the words, not a surface under the answer box. The answer
    // box is a form, and a field never sits below one.
    const mark = container.querySelector('.grain-mark')
    expect(mark).toHaveClass('grain-working')
    expect(mark).toHaveClass('field-unresolved')
    expect(mark).toHaveStyle({ '--grain': 'var(--grain-3)' })
    expect(container.querySelector('.grain-field')).toBeNull()
    expect(screen.getByText('Marking your answer')).toBeInTheDocument()

    await release()
    expect(await screen.findByText(sampleGrade.feedback)).toBeInTheDocument()
    expect(container.querySelector('.grain-working')).toBeNull()
  })

  /* Grain with no field is texture with nothing behind it — grain and colour
     are one axis. The graded block carried `.grain` at the ambient intensity
     and said nothing by it. */
  it('leaves the marked answer on clean paper', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <OpenQuestionArtefact artefact={openQuestionFixture} onGrade={() => sampleGrade} />,
    )

    await user.type(screen.getByLabelText('Your answer'), 'It keeps its direction.')
    await user.click(screen.getByRole('button', { name: 'Send your answer' }))
    await screen.findByText(sampleGrade.feedback)

    expect(container.querySelector('.grain')).toBeNull()
  })

  it('names the verdict in words and lists what the answer left out', async () => {
    const user = userEvent.setup()
    render(<OpenQuestionArtefact artefact={openQuestionFixture} onGrade={grade} />)

    await user.type(screen.getByLabelText('Your answer'), 'It keeps its direction.')
    await user.click(screen.getByRole('button', { name: 'Send your answer' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Part of it is there.',
    )
    expect(screen.getByRole('heading', { name: 'Still missing' })).toBeInTheDocument()
    expect(screen.getByText(sampleGrade.missing[0])).toBeInTheDocument()
  })

  it('holds the model answer back until the learner asks for it', async () => {
    const user = userEvent.setup()
    render(<OpenQuestionArtefact artefact={openQuestionFixture} onGrade={grade} />)

    await user.type(screen.getByLabelText('Your answer'), 'It keeps its direction.')
    await user.click(screen.getByRole('button', { name: 'Send your answer' }))

    const reveal = await screen.findByRole('button', { name: 'Show a full answer' })
    expect(screen.queryByText(/points along v/)).not.toBeInTheDocument()

    await user.click(reveal)
    expect(screen.getByText(/points along v/)).toBeInTheDocument()
  })

  it('marks a wrong answer with the one ink rule the design allows', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <OpenQuestionArtefact
        artefact={openQuestionFixture}
        onGrade={async () => ({
          verdict: 'incorrect',
          score: 0,
          missing: openQuestionFixture.payload.criteria,
          feedback: 'None of the three points is in the answer.',
        })}
      />,
    )

    await user.type(screen.getByLabelText('Your answer'), 'No idea.')
    await user.click(screen.getByRole('button', { name: 'Send your answer' }))

    expect(await screen.findByRole('status')).toHaveTextContent('That is not it yet.')
    expect(container.querySelector('.border-l-2')).not.toBeNull()
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
