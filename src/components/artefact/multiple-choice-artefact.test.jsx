import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import MultipleChoiceArtefact from './multiple-choice-artefact'
import { multipleChoiceFixture } from '@/lib/artefact-fixtures'

const { options, rationales } = multipleChoiceFixture.payload

describe('MultipleChoiceArtefact', () => {
  /* Chrome draws its own widget for a radio at `appearance: auto` and ignores
     an author radius, so the focus outline came out square around a round
     control. Drawing the control ourselves is what lets the ring follow it —
     and empty ring / filled dot is the same legend the field marks use. */
  it('draws its own round radio, so the focus ring is not a square', () => {
    render(<MultipleChoiceArtefact artefact={multipleChoiceFixture} />)

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveClass('appearance-none', 'rounded-round')
    }
  })

  it('offers the options as a named set of radios', () => {
    render(<MultipleChoiceArtefact artefact={multipleChoiceFixture} />)

    expect(screen.getByRole('radiogroup', { name: 'Your answer' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: options[0] })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(options.length)
  })

  it('keeps every rationale hidden until an answer is given', () => {
    render(<MultipleChoiceArtefact artefact={multipleChoiceFixture} />)

    expect(screen.queryByText(rationales[3])).not.toBeInTheDocument()
  })

  it('will not check an empty answer', () => {
    render(<MultipleChoiceArtefact artefact={multipleChoiceFixture} />)

    expect(screen.getByRole('button', { name: 'Check your answer' })).toBeDisabled()
  })

  it('states the outcome in words and gives a reason for every option', async () => {
    const user = userEvent.setup()
    render(<MultipleChoiceArtefact artefact={multipleChoiceFixture} />)

    await user.click(screen.getByRole('radio', { name: options[2] }))
    await user.click(screen.getByRole('button', { name: 'Check your answer' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      `Not right. The answer is "${options[0]}".`,
    )
    // Including the rationale for the option that was right.
    expect(screen.getByText(/only where the determinant vanishes/)).toBeInTheDocument()
    // The third rationale carries inline mathematics, so it is matched by the
    // words around the formula rather than as one string.
    expect(screen.getByText(/Rank is the dimension of the image/)).toBeInTheDocument()
    expect(screen.getByText(rationales[3])).toBeInTheDocument()
  })

  it('says so plainly when the answer was right', async () => {
    const user = userEvent.setup()
    render(<MultipleChoiceArtefact artefact={multipleChoiceFixture} />)

    await user.click(screen.getByRole('radio', { name: options[0] }))
    await user.click(screen.getByRole('button', { name: 'Check your answer' }))

    expect(screen.getByRole('status')).toHaveTextContent('Right.')
  })

  it('carries the anchor of the section it was drawn from', async () => {
    const user = userEvent.setup()
    render(<MultipleChoiceArtefact artefact={multipleChoiceFixture} />)

    await user.click(screen.getByRole('radio', { name: options[0] }))
    await user.click(screen.getByRole('button', { name: 'Check your answer' }))

    expect(
      screen.getByRole('button', {
        name: 'Source 2, The characteristic polynomial, characters 1840–2104',
      }),
    ).toBeInTheDocument()
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

    await user.click(screen.getByRole('radio', { name: options[2] }))
    await user.click(screen.getByRole('button', { name: 'Check your answer' }))

    expect(answered[0]).toMatchObject({
      artefactId: multipleChoiceFixture.id,
      correct: false,
    })
  })
})
