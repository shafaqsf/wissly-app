import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ReviewSession from './review-session'
import { FORMAT_NAMES } from '@/components/task/task-types'
import { flashcardFixture } from '@/lib/artefact-fixtures'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const queue = [
  { ...flashcardFixture, id: 'a1' },
  { ...flashcardFixture, id: 'a2' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

/** Reveal the card, then rate it "Comfortably". */
async function answer(user) {
  await user.click(screen.getByRole('button', { name: /show/i }))
  await user.click(screen.getByRole('button', { name: 'Comfortably' }))
}

describe('ReviewSession', () => {
  it('puts the whole queue behind one surface', () => {
    render(<ReviewSession artefacts={queue} onRateAction={vi.fn()} onGradeAction={vi.fn()} />)

    expect(screen.getByText(`1 of ${queue.length} due`)).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: FORMAT_NAMES[queue[0].format] }),
    ).toBeInTheDocument()
  })

  it('names the artefact being rated, so the server knows what was answered', async () => {
    const user = userEvent.setup()
    const onRateAction = vi.fn(async () => ({}))

    render(<ReviewSession artefacts={queue} onRateAction={onRateAction} onGradeAction={vi.fn()} />)
    await answer(user)

    expect(onRateAction).toHaveBeenCalledWith({ artefactId: 'a1', rating: 3 })
  })

  it('leaves the rhythm alone until the sitting is over', async () => {
    const user = userEvent.setup()
    const onRateAction = vi.fn(async () => ({}))

    render(<ReviewSession artefacts={queue} onRateAction={onRateAction} onGradeAction={vi.fn()} />)

    await answer(user)
    // One artefact of two answered: refreshing here would replace the queue
    // mid-sitting.
    expect(refresh).not.toHaveBeenCalled()

    await answer(user)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
