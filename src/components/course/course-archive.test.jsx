import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import CourseArchive from './course-archive'

const noop = async () => {}

const sources = [{ id: 'source-1', title: 'Lecture 3', kind: 'pdf', sections: [] }]
const artefacts = [
  {
    id: 'a1',
    format: 'glossary',
    payload: { term: 'Refraction', definition: 'Light bending.' },
    section_ordinal: 1,
    anchor: { page: 12 },
  },
]

describe('the course archive', () => {
  it('says the archive is empty rather than showing nothing at all', () => {
    render(
      <CourseArchive
        courseId="course-1"
        sources={[]}
        artefacts={[]}
        restoreSourceAction={noop}
        restoreReadingAction={noop}
      />,
    )

    expect(
      screen.getByText('Nothing archived. What you archive from this course lands here.'),
    ).toBeInTheDocument()
  })

  it('lists an archived source with a way back', () => {
    render(
      <CourseArchive
        courseId="course-1"
        sources={sources}
        artefacts={[]}
        restoreSourceAction={noop}
        restoreReadingAction={noop}
      />,
    )

    expect(screen.getByText('Lecture 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore Lecture 3' })).toBeInTheDocument()
  })

  it('lists archived reading with a way back', () => {
    render(
      <CourseArchive
        courseId="course-1"
        sources={[]}
        artefacts={artefacts}
        restoreSourceAction={noop}
        restoreReadingAction={noop}
      />,
    )

    expect(screen.getByText('Refraction')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore Refraction' })).toBeInTheDocument()
  })

  it('nothing here deletes — archiving is soft everywhere', () => {
    render(
      <CourseArchive
        courseId="course-1"
        sources={sources}
        artefacts={artefacts}
        restoreSourceAction={noop}
        restoreReadingAction={noop}
      />,
    )

    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  })
})
