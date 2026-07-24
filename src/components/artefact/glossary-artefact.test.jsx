import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import GlossaryArtefact from './glossary-artefact'
import { glossaryFixture } from '@/lib/artefact-fixtures'

describe('GlossaryArtefact', () => {
  it('pairs every term with its definition in a description list', () => {
    const { container } = render(<GlossaryArtefact artefact={glossaryFixture} />)

    expect(container.querySelector('dl')).not.toBeNull()
    expect(screen.getByText('Eigenvector')).toBeInTheDocument()
    expect(screen.getByText(/direction a matrix leaves alone/)).toBeInTheDocument()
  })

  it('gives every entry the anchor its definition came from', async () => {
    const user = userEvent.setup()
    render(<GlossaryArtefact artefact={glossaryFixture} />)

    await user.click(
      screen.getByRole('button', {
        name: 'Source 2, Lecture notes, The characteristic polynomial',
      }),
    )

    expect(screen.getByText(/roots of det/)).toBeInTheDocument()
  })
})
