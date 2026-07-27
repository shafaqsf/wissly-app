import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ImportForm from './import-form'

const noop = () => ({})

describe('the import form', () => {
  it('offers to import the named course', () => {
    render(<ImportForm courseId="pub-1" action={noop} />)

    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument()
  })

  it('carries which course it imports', () => {
    const { container } = render(<ImportForm courseId="pub-1" action={noop} />)

    expect(container.querySelector('input[name="courseId"]')).toHaveValue('pub-1')
  })

  it('shows what the server said when importing fails', () => {
    render(
      <ImportForm
        courseId="pub-1"
        action={noop}
        initialState={{ message: 'That course is not public, or no longer exists.' }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'That course is not public, or no longer exists.',
    )
  })
})
