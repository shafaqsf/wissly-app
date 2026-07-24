import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import SummaryArtefact from './summary-artefact'
import { summaryFixture } from '@/lib/artefact-fixtures'

describe('SummaryArtefact', () => {
  it('opens at the shallowest layer', () => {
    render(<SummaryArtefact artefact={summaryFixture} />)

    expect(screen.getByText(/keeps its direction/)).toBeInTheDocument()
    expect(screen.queryByText(/Rearranging gives/)).not.toBeInTheDocument()
  })

  it('reads the three sentences as one run of prose', () => {
    const { container } = render(<SummaryArtefact artefact={summaryFixture} />)

    expect(container.querySelector('p')).toBeInTheDocument()
    expect(container.textContent).toContain(
      summaryFixture.payload.three_sentences[1],
    )
  })

  it('offers the three depths the payload has, and says which one you read', () => {
    render(<SummaryArtefact artefact={summaryFixture} />)

    expect(screen.getByRole('group', { name: 'Depth' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Three sentences' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'A paragraph' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Full depth' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('switches to the depth the learner picks', async () => {
    const user = userEvent.setup()
    render(<SummaryArtefact artefact={summaryFixture} />)

    await user.click(screen.getByRole('radio', { name: 'Full depth' }))

    expect(screen.getByText(/Rearranging gives/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Full depth' })).toBeChecked()
  })

  it('carries the anchor of the section it summarised', () => {
    render(<SummaryArtefact artefact={summaryFixture} />)

    expect(
      screen.getByRole('button', { name: 'Source 1, page 12' }),
    ).toBeInTheDocument()
  })
})
