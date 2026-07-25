import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ExportReading from './export-reading'

const artefacts = [
  {
    id: 'a1',
    format: 'glossary',
    payload: { term: 'Refraction', definition: 'Light bending.' },
    section_ordinal: 1,
    anchor: { page: 12 },
  },
]

let click

beforeEach(() => {
  click = vi.fn()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exporting a course’s reading', () => {
  it('offers the export as something the learner triggers', () => {
    render(<ExportReading title="Optics" artefacts={artefacts} />)

    expect(screen.getByRole('button', { name: 'Export reading' })).toBeInTheDocument()
  })

  it('hands over a Markdown file named after the course', async () => {
    const user = userEvent.setup()
    render(<ExportReading title="Optics" artefacts={artefacts} />)

    await user.click(screen.getByRole('button', { name: 'Export reading' }))

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('text/markdown')
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('is offered even with nothing to export, and says so', () => {
    render(<ExportReading title="Optics" artefacts={[]} />)

    expect(screen.getByRole('button', { name: 'Export reading' })).toBeDisabled()
  })
})
