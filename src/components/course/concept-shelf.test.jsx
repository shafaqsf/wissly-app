import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ConceptShelf from './concept-shelf'

const concepts = [
  { id: 'c1', name: 'Refraction', mastery: 0 },
  { id: 'c2', name: 'Snell’s law', mastery: 0.5 },
  { id: 'c3', name: 'Total internal reflection', mastery: 0.95 },
]

describe('the concept shelf', () => {
  it('names what the material covers', () => {
    render(<ConceptShelf concepts={concepts} />)

    expect(screen.getByText('Refraction')).toBeInTheDocument()
    expect(screen.getByText('Total internal reflection')).toBeInTheDocument()
  })

  /* A mark is never the only carrier of meaning — docs/DESIGN.md. Twelve
     pixels of grey say nothing to a screen reader. */
  it('names the state each mark encodes, in words beside it', () => {
    render(<ConceptShelf concepts={concepts} />)

    expect(screen.getByText('Untouched')).toBeInTheDocument()
    expect(screen.getByText('In progress')).toBeInTheDocument()
    expect(screen.getByText('Mastered')).toBeInTheDocument()
  })

  it('wears a mark per concept, painted by the one state class', () => {
    const { container } = render(<ConceptShelf concepts={concepts} />)

    const marks = container.querySelectorAll('.grain-mark')
    expect(marks).toHaveLength(3)
    expect(marks[0]).toHaveClass('field-unresolved')
    expect(marks[1]).toHaveClass('field-partial')
    expect(marks[2]).toHaveClass('field-settled')
  })

  it('hides the mark from the accessibility tree, since the word carries it', () => {
    const { container } = render(<ConceptShelf concepts={concepts} />)

    for (const mark of container.querySelectorAll('.grain-mark')) {
      expect(mark).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('paints no background — a row is text on paper', () => {
    const { container } = render(<ConceptShelf concepts={concepts} />)

    expect(container.querySelector('.grain-field')).toBeNull()
    expect(container.querySelector('.grain-wash')).toBeNull()
  })

  it('reads a row as its concept and its state together', () => {
    render(<ConceptShelf concepts={[concepts[1]]} />)

    const row = screen.getByRole('listitem')
    expect(within(row).getByText('Snell’s law')).toBeInTheDocument()
    expect(within(row).getByText('In progress')).toBeInTheDocument()
  })
})
