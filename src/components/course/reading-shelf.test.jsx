import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ReadingShelf from './reading-shelf'

const noop = async () => {}

const artefacts = [
  {
    id: 'a1',
    subject_id: 'course-1',
    section_id: 'sec-1',
    format: 'glossary',
    payload: { term: 'Refraction', definition: 'Light bending at a boundary.' },
    section_ordinal: 1,
    anchor: { page: 12 },
    passage: 'Light bends at a boundary between two media.',
  },
  {
    id: 'a2',
    subject_id: 'course-1',
    section_id: 'sec-2',
    format: 'summary',
    payload: {
      three_sentences: ['One.', 'Two.', 'Three.'],
      paragraph: 'A paragraph.',
      full: 'Full depth.',
    },
    section_ordinal: 2,
    anchor: { page: 13 },
    passage: 'Snell relates the angles.',
  },
]

describe('the reading shelf', () => {
  it('renders a glossary entry with its own renderer', () => {
    render(<ReadingShelf courseId="course-1" artefacts={artefacts} archiveAction={noop} />)

    expect(screen.getByText('Refraction')).toBeInTheDocument()
    expect(screen.getByText(/Light bending at a boundary/)).toBeInTheDocument()
  })

  it('renders a summary with its depth switch', () => {
    render(<ReadingShelf courseId="course-1" artefacts={artefacts} archiveAction={noop} />)

    expect(screen.getByRole('group', { name: 'Depth' })).toBeInTheDocument()
  })

  it('shows no task format here — those are answered, not read', () => {
    render(
      <ReadingShelf
        courseId="course-1"
        artefacts={[
          ...artefacts,
          { id: 'a3', format: 'flashcard', payload: { front: 'Q?', back: 'A' } },
        ]}
        archiveAction={noop}
      />,
    )

    expect(screen.queryByText('Q?')).toBeNull()
  })

  it('offers to archive each piece, naming the format it is archiving', () => {
    render(<ReadingShelf courseId="course-1" artefacts={artefacts} archiveAction={noop} />)

    expect(screen.getByRole('button', { name: 'Archive this glossary entry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive this summary' })).toBeInTheDocument()
  })

  it('carries the row and the course the archive verb acts on', () => {
    const { container } = render(
      <ReadingShelf courseId="course-1" artefacts={[artefacts[0]]} archiveAction={noop} />,
    )

    const form = container.querySelector('form[action]') ?? container.querySelector('form')
    expect(within(form).getByDisplayValue('a1')).toHaveAttribute('type', 'hidden')
    expect(within(form).getByDisplayValue('course-1')).toHaveAttribute('type', 'hidden')
  })

  it('hides the archive control for a viewer who cannot edit', () => {
    render(<ReadingShelf courseId="course-1" artefacts={artefacts} archiveAction={noop} canEdit={false} />)

    expect(screen.queryByRole('button', { name: /Archive/ })).toBeNull()
  })
})
