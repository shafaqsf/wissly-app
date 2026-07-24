import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import CitationAnchor from './citation-anchor'

const passage =
  'A vector v is an eigenvector of A when Av is a scalar multiple of v.'

describe('CitationAnchor', () => {
  it('renders the ordinal as a superscript numeral a learner can activate', () => {
    render(<CitationAnchor ordinal={1} anchor={{ page: 12 }} passage={passage} />)

    const anchor = screen.getByRole('button', { name: /source 1/i })
    expect(anchor).toHaveTextContent('1')
    expect(anchor.closest('sup')).not.toBeNull()
  })

  it('names a page anchor the way the source is paginated', () => {
    render(<CitationAnchor ordinal={3} anchor={{ page: 12 }} />)

    expect(
      screen.getByRole('button', { name: 'Source 3, page 12' }),
    ).toBeInTheDocument()
  })

  it('names a text anchor by its heading and character range', () => {
    render(
      <CitationAnchor
        ordinal={2}
        anchor={{ start: 1840, end: 2104, heading: 'The characteristic polynomial' }}
      />,
    )

    expect(
      screen.getByRole('button', {
        name: 'Source 2, The characteristic polynomial, characters 1840–2104',
      }),
    ).toBeInTheDocument()
  })

  it('falls back to the range alone when the text has no heading', () => {
    render(<CitationAnchor ordinal={2} anchor={{ start: 10, end: 40 }} />)

    expect(
      screen.getByRole('button', { name: 'Source 2, characters 10–40' }),
    ).toBeInTheDocument()
  })

  it('keeps the passage closed until it is asked for', () => {
    render(<CitationAnchor ordinal={1} anchor={{ page: 12 }} passage={passage} />)

    expect(screen.getByRole('button', { name: /source 1/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByText(/eigenvector of A/)).not.toBeInTheDocument()
  })

  it('opens the source passage, and closes it again', async () => {
    const user = userEvent.setup()
    render(<CitationAnchor ordinal={1} anchor={{ page: 12 }} passage={passage} />)

    const anchor = screen.getByRole('button', { name: /source 1/i })
    await user.click(anchor)

    expect(anchor).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/eigenvector of A/)).toBeInTheDocument()
    expect(screen.getByText('page 12')).toBeInTheDocument()

    await user.click(anchor)
    expect(screen.queryByText(/eigenvector of A/)).not.toBeInTheDocument()
  })

  it('says where to look when the passage itself was not loaded', async () => {
    const user = userEvent.setup()
    render(<CitationAnchor ordinal={1} anchor={{ page: 12 }} />)

    await user.click(screen.getByRole('button', { name: /source 1/i }))

    expect(
      screen.getByText('Open the section at page 12 to read the passage.'),
    ).toBeInTheDocument()
  })

  // jsdom has no layout, so the 44px target is asserted through the utility
  // that draws it. See `.tap-44` in globals.css.
  it('keeps a 44px tap target around a numeral that must stay small', () => {
    render(<CitationAnchor ordinal={1} anchor={{ page: 12 }} />)

    expect(screen.getByRole('button', { name: /source 1/i })).toHaveClass('tap-44')
  })

  it('carries no grain, because a citation is not an unresolved state', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <CitationAnchor ordinal={1} anchor={{ page: 12 }} passage={passage} />,
    )

    await user.click(screen.getByRole('button', { name: /source 1/i }))
    expect(container.querySelector('.grain')).toBeNull()
  })
})
