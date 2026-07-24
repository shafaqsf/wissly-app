import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import NotFound from './not-found'

describe('a URL that is not a page', () => {
  it('says what happened rather than showing an empty screen', () => {
    render(<NotFound />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'This page is not here',
    )
  })

  it('offers the way back that a learner actually wants', () => {
    render(<NotFound />)

    expect(screen.getByRole('link', { name: 'Go to your dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })
})
