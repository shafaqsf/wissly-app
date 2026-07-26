// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fitWeights, requireUserId, reviewLogFor, revalidatePath, saveWeights, weightsFor } =
  vi.hoisted(() => ({
    fitWeights: vi.fn(),
    requireUserId: vi.fn(async () => 'user-1'),
    reviewLogFor: vi.fn(),
    revalidatePath: vi.fn(),
    saveWeights: vi.fn(),
    weightsFor: vi.fn(),
  }))

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId }))
vi.mock('@/lib/data/fsrs-weights.js', () => ({ reviewLogFor, saveWeights, weightsFor }))
vi.mock('@/lib/review/fit-weights.js', () => ({ fitWeights, MIN_REVIEWS_TO_FIT: 50 }))
vi.mock('next/cache', () => ({ revalidatePath }))

import { recomputeWeightsAction } from './fsrs-weights.js'

function reviewsOf(count) {
  return Array.from({ length: count }, (_, i) => ({
    artefact_id: `a${i % 5}`,
    rating: 3,
    reviewed_at: '2026-07-01T00:00:00.000Z',
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUserId.mockResolvedValue('user-1')
  weightsFor.mockResolvedValue(null)
})

describe('recomputing FSRS weights', () => {
  it('declines when there is not enough review history yet', async () => {
    reviewLogFor.mockResolvedValue(reviewsOf(12))

    const state = await recomputeWeightsAction({}, new FormData())

    expect(state.message).toMatch(/12/)
    expect(state.message).toMatch(/50/)
    expect(fitWeights).not.toHaveBeenCalled()
    expect(saveWeights).not.toHaveBeenCalled()
  })

  it('fits, stores and reports the improvement once there is enough history', async () => {
    const reviews = reviewsOf(60)
    reviewLogFor.mockResolvedValue(reviews)
    fitWeights.mockReturnValue({
      weights: Array(17).fill(1),
      loss: 0.2,
      startingLoss: 0.5,
      reviewCount: 60,
      improved: true,
    })

    const state = await recomputeWeightsAction({}, new FormData())

    expect(fitWeights).toHaveBeenCalledWith(reviews, { initialWeights: undefined })
    expect(saveWeights).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user-1',
      weights: Array(17).fill(1),
      reviewCount: 60,
      loss: 0.2,
    })
    expect(revalidatePath).toHaveBeenCalledWith('/settings')
    expect(state.fitted).toBe(true)
    expect(state.message).toMatch(/60/)
  })

  it('starts the search from an existing fit rather than the defaults, when there is one', async () => {
    weightsFor.mockResolvedValue({ weights: Array(17).fill(2), reviewCount: 90, loss: 0.4, fittedAt: 'x' })
    reviewLogFor.mockResolvedValue(reviewsOf(90))
    fitWeights.mockReturnValue({
      weights: Array(17).fill(2),
      loss: 0.4,
      startingLoss: 0.4,
      reviewCount: 90,
      improved: false,
    })

    await recomputeWeightsAction({}, new FormData())

    expect(fitWeights).toHaveBeenCalledWith(
      expect.anything(),
      { initialWeights: Array(17).fill(2) },
    )
  })

  it('leaves the schedule alone and says so when the search found nothing better', async () => {
    reviewLogFor.mockResolvedValue(reviewsOf(60))
    fitWeights.mockReturnValue({
      weights: Array(17).fill(1),
      loss: 0.5,
      startingLoss: 0.5,
      reviewCount: 60,
      improved: false,
    })

    const state = await recomputeWeightsAction({}, new FormData())

    expect(saveWeights).not.toHaveBeenCalled()
    expect(state.fitted).toBeFalsy()
    expect(state.message).toMatch(/nothing changed|already/i)
  })
})
