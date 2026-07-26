import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ComparisonTableArtefact from './comparison-table-artefact'
import { comparisonTableFixture } from '@/lib/artefact-fixtures'

const { items, dimensions, cells } = comparisonTableFixture.payload

describe('ComparisonTableArtefact', () => {
  it('reads rather than answers — no radio, no input, no button to check', () => {
    render(<ComparisonTableArtefact artefact={comparisonTableFixture} />)

    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /check/i })).not.toBeInTheDocument()
  })

  it('names every item as a column and every dimension as a row', () => {
    render(<ComparisonTableArtefact artefact={comparisonTableFixture} />)

    for (const item of items) {
      expect(screen.getByRole('columnheader', { name: item })).toBeInTheDocument()
    }
    for (const dimension of dimensions) {
      expect(screen.getByRole('rowheader', { name: dimension })).toBeInTheDocument()
    }
  })

  it('shows a value and a rationale for every cell', () => {
    render(<ComparisonTableArtefact artefact={comparisonTableFixture} />)

    // Values repeat by design (a table full of "Yes"/"No" is the normal
    // case), so only the count is asserted for those; rationales are unique
    // per fixture and can be matched by text — except the two that carry
    // inline mathematics, which KaTeX splits into sibling nodes the way
    // multiple-choice-artefact.test.jsx already works around: matched by the
    // plain-text words around the formula rather than as one string.
    const byValue = new Map()
    for (const cell of cells) {
      byValue.set(cell.value, (byValue.get(cell.value) ?? 0) + 1)

      if (cell.rationale.includes('$')) {
        const [fragment] = cell.rationale
          .split(/\$[^$]*\$/)
          .map((part) => part.trim())
          .filter(Boolean)
        expect(screen.getByText(new RegExp(fragment))).toBeInTheDocument()
      } else {
        expect(screen.getByText(cell.rationale)).toBeInTheDocument()
      }
    }
    for (const [value, count] of byValue) {
      expect(screen.getAllByText(value)).toHaveLength(count)
    }
  })

  it('carries the anchor of the section it was drawn from', async () => {
    const user = userEvent.setup()
    render(<ComparisonTableArtefact artefact={comparisonTableFixture} />)

    await user.click(
      screen.getByRole('button', {
        name: 'Source 2, The characteristic polynomial, characters 1840–2104',
      }),
    )

    expect(screen.getByRole('link', { name: 'Open the section' })).toHaveAttribute(
      'href',
      '/courses/subject-linear-algebra#section-section-characteristic-polynomial',
    )
  })
})
