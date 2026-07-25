import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import TaskCard from './task-card'
import {
  clozeFixture,
  flashcardFixture,
  multipleChoiceFixture,
  openQuestionFixture,
  summaryFixture,
} from '@/lib/artefact-fixtures'

/* The mixed queue is the one place four types are shown one after another, so
   it is the one place a small dispatch earns its keep. Everywhere else the
   type is known before the page renders and has a surface of its own. */
describe('TaskCard', () => {
  it('renders a flashcard, and names it the way a learner would', () => {
    render(<TaskCard artefact={flashcardFixture} />)

    expect(screen.getByRole('region', { name: 'Flashcard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show the answer' })).toBeInTheDocument()
  })

  it('renders a cloze', () => {
    render(<TaskCard artefact={clozeFixture} />)

    expect(screen.getByRole('region', { name: 'Cloze' })).toBeInTheDocument()
  })

  it('renders a multiple choice question', () => {
    render(<TaskCard artefact={multipleChoiceFixture} />)

    expect(screen.getByRole('region', { name: 'Multiple choice' })).toBeInTheDocument()
  })

  it('renders an open question', () => {
    render(<TaskCard artefact={openQuestionFixture} />)

    expect(screen.getByRole('region', { name: 'Open question' })).toBeInTheDocument()
  })

  it('says so rather than breaking when the queue holds something unanswerable', () => {
    render(<TaskCard artefact={summaryFixture} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This is read rather than answered, so it is not due. Skip it.',
    )
  })

  it('never says "artefact" to the learner', () => {
    const { container } = render(<TaskCard artefact={flashcardFixture} />)

    expect(container.textContent.toLowerCase()).not.toContain('artefact')
  })
})
