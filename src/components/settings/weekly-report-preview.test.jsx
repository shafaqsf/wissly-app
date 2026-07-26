import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const { sendWeeklyReportAction } = vi.hoisted(() => ({
  sendWeeklyReportAction: vi.fn(async () => ({
    message: 'Your report was built. Email delivery is not wired up yet, so it was written to the server log instead of your inbox.',
  })),
}))

vi.mock('@/lib/actions/weekly-report.js', () => ({ sendWeeklyReportAction }))

import WeeklyReportPreview from './weekly-report-preview'

describe('WeeklyReportPreview', () => {
  it('builds the report on request and says plainly it was not emailed', async () => {
    const user = userEvent.setup()
    render(<WeeklyReportPreview />)

    await user.click(screen.getByRole('button', { name: /preview/i }))

    expect(sendWeeklyReportAction).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/not wired up yet/i)).toBeInTheDocument()
  })
})
