import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ConceptMap from './concept-map'

const nodes = [
  { id: 'c1', name: 'Refraction', mastery: 0, subjectId: 'sub-1' },
  { id: 'c2', name: "Snell's law", mastery: 0.95, subjectId: 'sub-1' },
]

const edges = [{ source: 'c1', target: 'c2', reason: 'Same idea.', kind: 'link' }]

describe('the concept map', () => {
  it('names every concept it draws', () => {
    render(<ConceptMap courseId="sub-1" nodes={nodes} edges={edges} />)

    expect(screen.getByRole('link', { name: 'Refraction' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: "Snell's law" })).toBeInTheDocument()
  })

  it('wears a mark per node, painted by the same state class the shelf uses', () => {
    const { container } = render(<ConceptMap courseId="sub-1" nodes={nodes} edges={edges} />)

    const marks = container.querySelectorAll('.grain-mark')
    expect(marks).toHaveLength(2)
    expect(marks[0]).toHaveClass('field-unresolved')
    expect(marks[1]).toHaveClass('field-settled')
  })

  it('draws one line per edge, in the hairline colour and no other', () => {
    const { container } = render(<ConceptMap courseId="sub-1" nodes={nodes} edges={edges} />)

    const lines = container.querySelectorAll('line')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toHaveAttribute('stroke', 'var(--rule)')
  })

  it('draws nothing for an edge naming a node it was not given', () => {
    const { container } = render(
      <ConceptMap
        courseId="sub-1"
        nodes={nodes}
        edges={[{ source: 'c1', target: 'ghost' }]}
      />,
    )

    expect(container.querySelectorAll('line')).toHaveLength(0)
  })

  it('gives every node an anchor "see also" can jump to', () => {
    const { container } = render(<ConceptMap courseId="sub-1" nodes={nodes} edges={edges} />)

    expect(container.querySelector('#concept-c1')).not.toBeNull()
    expect(container.querySelector('#concept-c2')).not.toBeNull()
  })

  it('renders nothing for an empty course without crashing', () => {
    const { container } = render(<ConceptMap courseId="sub-1" nodes={[]} edges={[]} />)

    expect(container.querySelectorAll('.grain-mark')).toHaveLength(0)
  })
})
