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

    expect(screen.getByText(/agentic learning platform/i)).toBeInTheDocument()
  })

  it('says the platform is open source', () => {
    render(<Home />)

    expect(screen.getByText(/open source/i)).toBeInTheDocument()
  })

  it('exposes exactly one main landmark', () => {
    render(<Home />)

    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('carries a single grain field, so the noise reads as one signal', () => {
    const { container } = render(<Home />)

    expect(container.querySelectorAll('.grain')).toHaveLength(1)
  })
})
