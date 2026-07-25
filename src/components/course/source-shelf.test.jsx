import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import SourceShelf from './source-shelf'

const noop = async () => {}

const sources = [
  {
    id: 'source-1',
    title: 'Lecture 3',
    kind: 'pdf',
    sections: [
      { id: 'sec-1', ordinal: 1, content: 'Light bends at a boundary.', anchor: { page: 12 } },
      {
        id: 'sec-2',
        ordinal: 2,
        content: 'Snell relates the two angles.',
        anchor: { start: 10, end: 40, heading: 'Snell' },
      },
    ],
  },
  { id: 'source-2', title: 'My notes', kind: 'text', sections: [] },
]

describe('the source shelf', () => {
  it('names every source and how much it was cut into', () => {
    render(<SourceShelf courseId="course-1" sources={sources} archiveAction={noop} />)

    expect(screen.getByText('Lecture 3')).toBeInTheDocument()
    expect(screen.getByText('My notes')).toBeInTheDocument()
    expect(screen.getByText(/2 sections/)).toBeInTheDocument()
  })

  it('expands a source into its sections', () => {
    const { container } = render(
      <SourceShelf courseId="course-1" sources={sources} archiveAction={noop} />,
    )

    const details = container.querySelectorAll('details')
    expect(details).toHaveLength(2)
    expect(screen.getByText('Light bends at a boundary.')).toBeInTheDocument()
  })

  /* "Every claim points at its source" starts here: the section says where in
     the source it was cut from, in words a person can find again. */
  it('shows each section its anchor, in words rather than an offset', () => {
    render(<SourceShelf courseId="course-1" sources={sources} archiveAction={noop} />)

    expect(screen.getByText('page 12')).toBeInTheDocument()
    expect(screen.getByText('Snell, characters 10–40')).toBeInTheDocument()
  })

  /* A citation anchor links to `#section-<id>`, so the section has to be there
     under that id or the promise is a dead link. */
  it('gives every section the id a citation points at', () => {
    const { container } = render(
      <SourceShelf courseId="course-1" sources={sources} archiveAction={noop} />,
    )

    expect(container.querySelector('#section-sec-1')).not.toBeNull()
    expect(container.querySelector('#section-sec-2')).not.toBeNull()
  })

  it('offers to archive each source, naming which one', () => {
    render(<SourceShelf courseId="course-1" sources={sources} archiveAction={noop} />)

    expect(screen.getByRole('button', { name: 'Archive Lecture 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive My notes' })).toBeInTheDocument()
  })

  it('carries the row and the course the archive verb acts on', () => {
    const { container } = render(
      <SourceShelf courseId="course-1" sources={sources} archiveAction={noop} />,
    )

    const form = container.querySelector('form')
    expect(within(form).getByDisplayValue('source-1')).toHaveAttribute('type', 'hidden')
    expect(within(form).getByDisplayValue('course-1')).toHaveAttribute('type', 'hidden')
  })

  /* Analytics links a gap straight at the source that leaves it open, so the
     source it names has to arrive already expanded — a link that lands on a
     closed row has not shown anybody anything. */
  it('arrives with the named source already open', () => {
    const { container } = render(
      <SourceShelf
        courseId="course-1"
        sources={sources}
        archiveAction={noop}
        openSourceId="source-2"
      />,
    )

    const [first, second] = container.querySelectorAll('details')
    expect(first.open).toBe(false)
    expect(second.open).toBe(true)
  })

  it('gives every source the id a deep link can scroll to', () => {
    const { container } = render(
      <SourceShelf courseId="course-1" sources={sources} archiveAction={noop} />,
    )

    expect(container.querySelector('#source-source-1')).not.toBeNull()
    expect(container.querySelector('#source-source-2')).not.toBeNull()
  })

  it('opens nothing when the link names a source this course does not have', () => {
    const { container } = render(
      <SourceShelf
        courseId="course-1"
        sources={sources}
        archiveAction={noop}
        openSourceId="source-gone"
      />,
    )

    for (const details of container.querySelectorAll('details')) {
      expect(details.open).toBe(false)
    }
  })

  it('says a source with no sections has none rather than showing an empty list', () => {
    render(<SourceShelf courseId="course-1" sources={sources} archiveAction={noop} />)

    expect(screen.getByText('No sections were readable in this one.')).toBeInTheDocument()
  })
})
