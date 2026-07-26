import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import VisibilityToggle from './visibility-toggle'

const noop = async () => {}

describe('the visibility toggle', () => {
  it('says a private course is only visible to its owner, and offers to make it public', () => {
    render(<VisibilityToggle courseId="course-1" isPublic={false} action={noop} />)

    expect(screen.getByText(/only you can see this course/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make public' })).toBeInTheDocument()
  })

  it('says a public course is in the library, and offers to make it private', () => {
    render(<VisibilityToggle courseId="course-1" isPublic={true} action={noop} />)

    expect(screen.getByText(/public library/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make private' })).toBeInTheDocument()
  })

  it('flips the flag it submits, not the one it started with', () => {
    const { container } = render(
      <VisibilityToggle courseId="course-1" isPublic={false} action={noop} />,
    )

    expect(container.querySelector('input[name="isPublic"]')).toHaveValue('true')
  })

  it('names the course so the action knows which one', () => {
    const { container } = render(
      <VisibilityToggle courseId="course-1" isPublic={false} action={noop} />,
    )

    expect(container.querySelector('input[name="courseId"]')).toHaveValue('course-1')
  })
})
