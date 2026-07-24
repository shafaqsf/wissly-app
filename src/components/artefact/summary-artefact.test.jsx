import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import SummaryArtefact from './summary-artefact'
import { summaryFixture } from '@/lib/artefact-fixtures'

describe('SummaryArtefact', () => {
  it('opens at the shallowest layer', () => {
    render(<SummaryArtefact artefact={summaryFixture} />)

    expect(screen.getByText(/keeps its direction/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('offers every layer, and says which one you are reading', () => {
    render(<SummaryArtefact artefact={summaryFixture} />)

    const group = screen.getByRole('group', { name: 'Depth' })
    expect(group).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: 'Three sentences' }),
    ).toBeChecked()
    expect(screen.getByRole('radio', { name: 'A paragraph' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Full depth' })).toBeInTheDocument()
  })

  it('switches to the depth the learner picks', async () => {
    const user = userEvent.setup()
    render(<SummaryArtefact artefact={summaryFixture} />)

    await user.click(screen.getByRole('radio', { name: 'Full depth' }))

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Full depth' })).toBeChecked()
  })

  it('carries its citation anchors into the summary', () => {
    render(<SummaryArtefact artefact={summaryFixture} />)

    expect(
      screen.getByRole('button', {
        name: 'Source 1, Lecture notes, Linear maps',
      }),
    ).toBeInTheDocument()
  })
})
