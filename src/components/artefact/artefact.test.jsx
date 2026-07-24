import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Artefact, { FORMAT_NAMES } from './artefact'
import { FORMATS } from '@/lib/agent/formats'
import { artefactFixtures, sampleGrade } from '@/lib/artefact-fixtures'

describe('Artefact', () => {
  it('has a renderer and a learner-facing name for every Stage 1 format', () => {
    for (const format of FORMATS) {
      expect(FORMAT_NAMES[format]).toBeTruthy()
    }
  })

  it.each(FORMATS)(
    'renders a %s without the caller knowing which format it got',
    (format) => {
      render(
        <Artefact
          artefact={artefactFixtures[format]}
          onGrade={async () => sampleGrade}
        />,
      )

      expect(
        screen.getByRole('region', { name: FORMAT_NAMES[format] }),
      ).toBeInTheDocument()
    },
  )

  it('names the format the way a learner would', () => {
    render(<Artefact artefact={artefactFixtures.multiple_choice} />)

    expect(screen.getByText('Multiple choice')).toBeInTheDocument()
  })

  it('says so plainly when a format has no renderer yet', () => {
    render(<Artefact artefact={{ id: 'x', format: 'timeline' }} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This format cannot be shown yet. Pick another artefact for now.',
    )
  })
})
