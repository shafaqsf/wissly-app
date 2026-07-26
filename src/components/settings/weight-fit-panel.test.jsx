import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const { recomputeWeightsAction } = vi.hoisted(() => ({
  recomputeWeightsAction: vi.fn(async () => ({ message: 'Refitted from 60 reviews.', fitted: true })),
}))

vi.mock('@/lib/actions/fsrs-weights.js', () => ({ recomputeWeightsAction }))

import WeightFitPanel from './weight-fit-panel'

describe('the weight-fit panel', () => {
  it('says a learner has not fitted yet, and how far they are from being able to', () => {
    render(<WeightFitPanel existing={null} reviewCount={12} minReviews={50} />)

    expect(screen.getByText(/not fitted/i)).toBeInTheDocument()
    expect(screen.getByText(/12/)).toBeInTheDocument()
    expect(screen.getByText(/50/)).toBeInTheDocument()
  })

  it('reports an existing fit by how much history and how well it explains recall', () => {
    render(
      <WeightFitPanel
        existing={{ weights: Array(17).fill(1), reviewCount: 214, loss: 0.318, fittedAt: '2026-07-01T00:00:00.000Z' }}
        reviewCount={214}
        minReviews={50}
      />,
    )

    expect(screen.getByText(/214/)).toBeInTheDocument()
    expect(screen.getByText(/0\.318/)).toBeInTheDocument()
  })

  it('is a real number, on purpose — this is one of the analytics surfaces the no-percentage rule does not cover', () => {
    render(
      <WeightFitPanel
        existing={{ weights: Array(17).fill(1), reviewCount: 214, loss: 0.318, fittedAt: 'x' }}
        reviewCount={214}
        minReviews={50}
      />,
    )

    // Not asserting *against* a percentage here — the point of this panel is
    // that a real number is allowed. The assertion is just that the loss
    // value from the fit actually reached the screen.
    expect(screen.getByText(/0\.318/)).toBeInTheDocument()
  })

  it('lets the learner ask for a refit, and shows what it found', async () => {
    const user = userEvent.setup()
    render(<WeightFitPanel existing={null} reviewCount={60} minReviews={50} />)

    await user.click(screen.getByRole('button', { name: /recompute my weights/i }))

    expect(await screen.findByText('Refitted from 60 reviews.')).toBeInTheDocument()
  })
})
