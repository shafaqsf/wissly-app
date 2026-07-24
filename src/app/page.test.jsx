import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Home from './page'

describe('Home page', () => {
  it('names the platform in the main heading', () => {
    render(<Home />)

    expect(
      screen.getByRole('heading', { level: 1, name: /wissly/i }),
    ).toBeInTheDocument()
  })

  it('states what the platform is for', () => {
    render(<Home />)

    expect(
      screen.getByText(/agentic learning platform/i),
    ).toBeInTheDocument()
  })
})
