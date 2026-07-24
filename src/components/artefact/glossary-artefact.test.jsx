import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import GlossaryArtefact from './glossary-artefact'
import { glossaryFixture } from '@/lib/artefact-fixtures'

describe('GlossaryArtefact', () => {
  it('pairs the term with its definition in a description list', () => {
    const { container } = render(<GlossaryArtefact artefact={glossaryFixture} />)

    expect(container.querySelector('dl')).not.toBeNull()
    expect(screen.getByText('Eigenvector')).toBeInTheDocument()
    expect(screen.getByText(/direction a matrix leaves alone/)).toBeInTheDocument()
  })

  it('opens the passage the definition was drawn from', async () => {
    const user = userEvent.setup()
    render(<GlossaryArtefact artefact={glossaryFixture} />)

    await user.click(screen.getByRole('button', { name: 'Source 1, page 12' }))

    expect(screen.getByText(/scalar multiple of v/)).toBeInTheDocument()
  })
})
