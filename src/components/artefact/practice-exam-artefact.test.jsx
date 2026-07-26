import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import PracticeExamArtefact from './practice-exam-artefact'
import { practiceExamFixture } from '@/lib/artefact-fixtures'

const { title, instructions, time_limit_minutes: timeLimit, items } = practiceExamFixture.payload

describe('PracticeExamArtefact', () => {
  it('names the exam and says what it asks and how long it takes', () => {
    render(<PracticeExamArtefact artefact={practiceExamFixture} />)

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByText(instructions)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${timeLimit} minutes`))).toBeInTheDocument()
  })

  it('lists every task it draws from, one line each', () => {
    render(<PracticeExamArtefact artefact={practiceExamFixture} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(items.length)
  })

  it('is composed rather than generated, and says so', () => {
    render(<PracticeExamArtefact artefact={practiceExamFixture} />)

    expect(screen.getByText(/draws from tasks you have already answered/i)).toBeInTheDocument()
  })

  it('reports completion to the queue once the learner is done', async () => {
    const user = userEvent.setup()
    const answered = []
    render(
      <PracticeExamArtefact
        artefact={practiceExamFixture}
        onAnswered={(result) => answered.push(result)}
      />,
    )

    await user.click(screen.getByRole('button', { name: /mark this exam complete/i }))

    expect(answered[0]).toMatchObject({ artefactId: practiceExamFixture.id, correct: true })
  })

  it('carries no anchor of its own — it has no section to cite', () => {
    render(<PracticeExamArtefact artefact={practiceExamFixture} />)

    expect(screen.queryByText(/^from$/i)).not.toBeInTheDocument()
  })
})
