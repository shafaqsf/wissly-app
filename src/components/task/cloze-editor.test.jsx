import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import ClozeEditor from './cloze-editor'
import { CLOZE_BLANK } from '@/lib/agent/formats'

/** The two hidden fields that make up the payload. */
function fields(container) {
  return {
    text: container.querySelector('input[name="text"]').value,
    answer: container.querySelector('input[name="answer"]').value,
  }
}

describe('the cloze editor', () => {
  it('marks the word to take out in place, in the sentence itself', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ClozeEditor text={`An ${CLOZE_BLANK} keeps its direction.`} answer="eigenvector" />,
    )

    // The sentence is edited whole, never with a gap in the middle of it.
    expect(screen.getByLabelText('The sentence')).toHaveValue(
      'An eigenvector keeps its direction.',
    )
    expect(screen.getByRole('button', { name: 'eigenvector' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'direction.' }))

    expect(fields(container)).toEqual({
      // The full stop is punctuation, not part of the word being recalled.
      text: `An eigenvector keeps its ${CLOZE_BLANK}.`,
      answer: 'direction',
    })
  })

  it('puts the word back when it is clicked again', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ClozeEditor text={`An ${CLOZE_BLANK} keeps its direction.`} answer="eigenvector" />,
    )

    await user.click(screen.getByRole('button', { name: 'eigenvector' }))

    expect(fields(container)).toEqual({
      text: 'An eigenvector keeps its direction.',
      answer: '',
    })
  })

  it('asks for the word rather than guessing one', () => {
    render(<ClozeEditor />)

    expect(
      screen.getByText('Click the word the learner should have to remember.'),
    ).toBeInTheDocument()
  })

  it('drops the blank when the word is edited out of the sentence', async () => {
    const user = userEvent.setup()
    const { container } = render(<ClozeEditor text={`An ${CLOZE_BLANK}.`} answer="eigenvector" />)

    await user.clear(screen.getByLabelText('The sentence'))
    await user.type(screen.getByLabelText('The sentence'), 'A matrix.')

    expect(fields(container)).toEqual({ text: 'A matrix.', answer: '' })
  })
})
