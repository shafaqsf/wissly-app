import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import AddMaterialForm from './add-material-form'

/* The form moved off `/library` and onto a course page, which is the whole
   reason the subject picker is gone: the page already knows which course this
   is, and asking again invited a typo that filed the material somewhere else. */

const noop = async () => ({})

describe('the add material form', () => {
  it('does not ask which course — the page it sits on is the course', () => {
    render(<AddMaterialForm action={noop} courseId="course-1" />)

    expect(screen.queryByLabelText('Subject')).toBeNull()
    expect(screen.queryByLabelText(/course/i)).toBeNull()
  })

  it('carries the course of the page it sits on', () => {
    const { container } = render(<AddMaterialForm action={noop} courseId="course-1" />)

    const field = container.querySelector('input[name="courseId"]')
    expect(field).not.toBeNull()
    expect(field).toHaveAttribute('type', 'hidden')
    expect(field).toHaveValue('course-1')
  })

  it('still takes a title, pasted text or a file', () => {
    render(<AddMaterialForm action={noop} courseId="course-1" />)

    expect(screen.getByLabelText('What is it called')).toBeInTheDocument()
    expect(screen.getByLabelText('Paste the text')).toBeInTheDocument()
    expect(screen.getByLabelText('Or choose a PDF, a slide deck or a photo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add material' })).toBeInTheDocument()
  })

  it('also takes a link, as an alternative to text or a file', () => {
    render(<AddMaterialForm action={noop} courseId="course-1" />)

    const field = screen.getByLabelText('Or paste a link');
    expect(field).toHaveAttribute('type', 'url');
  })

  it('accepts a pdf, a pptx and a photo in the same file field', () => {
    const { container } = render(<AddMaterialForm action={noop} courseId="course-1" />)

    const field = container.querySelector('input[name="file"]');
    expect(field.accept).toContain('application/pdf');
    expect(field.accept).toContain('.pptx');
    expect(field.accept).toContain('image/*');
  })

  it('offers to explain PDF diagrams as an opt-in, unchecked by default', () => {
    render(<AddMaterialForm action={noop} courseId="course-1" />)

    const checkbox = screen.getByRole('checkbox', { name: /explain the diagrams/i });
    expect(checkbox).not.toBeChecked();
  })

  it('says what adding material does now, which is not generating', () => {
    render(<AddMaterialForm action={noop} courseId="course-1" />)

    expect(
      screen.getByText(/Nothing is generated|no model call|Reading it costs nothing/i),
    ).toBeInTheDocument()
  })

  it('rules a failure with a 2px ink border, since no colour may carry it', () => {
    render(
      <AddMaterialForm action={noop} courseId="course-1" initialState={{ message: 'It broke.' }} />,
    )

    expect(screen.getByRole('status')).toHaveClass('border-l-2')
  })

  it('leaves a report of what was added unruled — it is not a failure', () => {
    render(
      <AddMaterialForm
        action={noop}
        courseId="course-1"
        initialState={{ message: 'Added it.', done: true }}
      />,
    )

    expect(screen.getByRole('status')).not.toHaveClass('border-l-2')
  })
})
