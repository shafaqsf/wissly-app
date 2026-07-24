import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import CitationAnchor from './citation-anchor'

const source = {
  number: 1,
  id: 'section-12',
  label: 'Linear maps, page 12',
  passage:
    'A vector v is an eigenvector of A when Av is a scalar multiple of v.',
}

describe('CitationAnchor', () => {
  it('renders the source number as a superscript numeral a learner can activate', () => {
    render(<CitationAnchor source={source} />)

    const anchor = screen.getByRole('button', { name: /source 1/i })
    expect(anchor).toHaveTextContent('1')
    expect(anchor.closest('sup')).not.toBeNull()
  })

  it('names the source it points at, so the label is not just a numeral', () => {
    render(<CitationAnchor source={source} />)

    expect(
      screen.getByRole('button', { name: 'Source 1, Linear maps, page 12' }),
    ).toBeInTheDocument()
  })

  it('keeps the passage closed until it is asked for', () => {
    render(<CitationAnchor source={source} />)

    expect(screen.getByRole('button', { name: /source 1/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByText(/eigenvector of A/)).not.toBeInTheDocument()
  })

  it('opens the source passage, and closes it again', async () => {
    const user = userEvent.setup()
    render(<CitationAnchor source={source} />)

    const anchor = screen.getByRole('button', { name: /source 1/i })
    await user.click(anchor)

    expect(anchor).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/eigenvector of A/)).toBeInTheDocument()
    expect(screen.getByText('Linear maps, page 12')).toBeInTheDocument()

    await user.click(anchor)
    expect(screen.queryByText(/eigenvector of A/)).not.toBeInTheDocument()
  })

  // jsdom has no layout, so the 44px target is asserted through the utility
  // that draws it. See `.tap-44` in globals.css.
  it('keeps a 44px tap target around a numeral that must stay small', () => {
    render(<CitationAnchor source={source} />)

    expect(screen.getByRole('button', { name: /source 1/i })).toHaveClass(
      'tap-44',
    )
  })

  it('carries no grain, because a citation is not an unresolved state', async () => {
    const user = userEvent.setup()
    const { container } = render(<CitationAnchor source={source} />)

    await user.click(screen.getByRole('button', { name: /source 1/i }))
    expect(container.querySelector('.grain')).toBeNull()
  })
})
