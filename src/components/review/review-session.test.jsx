import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ReviewSession from './review-session'
import { FORMAT_NAMES } from '@/components/artefact/artefact'
import { reviewQueueFixture } from '@/lib/artefact-fixtures'

describe('ReviewSession', () => {
  it('puts the whole queue behind one surface', () => {
    render(<ReviewSession artefacts={reviewQueueFixture} />)

    expect(
      screen.getByText(`1 of ${reviewQueueFixture.length} due`),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: FORMAT_NAMES[reviewQueueFixture[0].format] }),
    ).toBeInTheDocument()
  })
})
