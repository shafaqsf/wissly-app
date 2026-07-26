import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import FindRelatedConcepts from './find-related-concepts'

const noop = async () => ({})

describe('finding related concepts', () => {
  it('carries the course it was asked from', () => {
    const { container } = render(<FindRelatedConcepts action={noop} courseId="course-1" />)

    const field = container.querySelector('input[name="subjectId"]')
    expect(field).not.toBeNull()
    expect(field).toHaveAttribute('type', 'hidden')
    expect(field).toHaveValue('course-1')
  })

  it('says what pressing it costs', () => {
    render(<FindRelatedConcepts action={noop} courseId="course-1" />)

    expect(screen.getByRole('button', { name: 'Find related concepts' })).toBeInTheDocument()
  })

  it('rules a failure with a 2px ink border, since no colour may carry it', () => {
    render(
      <FindRelatedConcepts
        action={noop}
        courseId="course-1"
        initialState={{ message: 'It broke.' }}
      />,
    )

    expect(screen.getByRole('status')).toHaveClass('border-l-2')
  })

  it('leaves a report of what was found unruled — it is not a failure', () => {
    render(
      <FindRelatedConcepts
        action={noop}
        courseId="course-1"
        initialState={{ message: 'Found 2 related concepts.', done: true }}
      />,
    )

    expect(screen.getByRole('status')).not.toHaveClass('border-l-2')
  })

  it('says nothing before the button has been pressed', () => {
    render(<FindRelatedConcepts action={noop} courseId="course-1" />)

    expect(screen.queryByRole('status')).toBeNull()
  })
})
