import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Artefact from './artefact'
import { artefactFixtures } from '@/lib/artefact-fixtures'

describe('Artefact', () => {
  it.each(Object.keys(artefactFixtures))(
    'renders a %s without the caller knowing which format it got',
    (format) => {
      render(
        <Artefact artefact={artefactFixtures[format]} onGrade={async () => ({})} />,
      )

      expect(
        screen.getByRole('region', { name: artefactFixtures[format].title }),
      ).toBeInTheDocument()
    },
  )

  it('names the format in a way a learner would', () => {
    render(<Artefact artefact={artefactFixtures.multiple_choice} />)

    expect(screen.getByText('Multiple choice')).toBeInTheDocument()
  })

  it('says so plainly when a format has no renderer yet', () => {
    render(<Artefact artefact={{ id: 'x', format: 'timeline', title: 'Timeline' }} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This format cannot be shown yet. Pick another artefact for now.',
    )
  })
})
