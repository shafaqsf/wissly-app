import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Prose from './prose'

const sources = [
  { number: 1, id: 'section-12', label: 'Linear maps, page 12', passage: 'p' },
]

describe('Prose', () => {
  it('renders a paragraph of running text', () => {
    render(<Prose blocks={[{ type: 'paragraph', text: 'Eigenvectors keep their direction.' }]} />)

    expect(
      screen.getByText('Eigenvectors keep their direction.'),
    ).toBeInTheDocument()
  })

  it('holds running prose to the 66-character measure', () => {
    const { container } = render(
      <Prose blocks={[{ type: 'paragraph', text: 'Running text.' }]} />,
    )

    expect(container.querySelector('p')).toHaveClass('max-w-measure')
  })

  it('renders an inline citation marker as an anchor to its source', () => {
    render(
      <Prose
        blocks={[{ type: 'paragraph', text: 'A scalar multiple. [[1]]' }]}
        sources={sources}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Source 1, Linear maps, page 12' }),
    ).toBeInTheDocument()
  })

  it('renders inline mathematics through KaTeX rather than as raw TeX', () => {
    const { container } = render(
      <Prose blocks={[{ type: 'paragraph', text: 'Take $Av = \\lambda v$ here.' }]} />,
    )

    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.textContent).not.toContain('\\lambda')
  })

  it('renders a display formula with an accessible description', () => {
    render(<Prose blocks={[{ type: 'math', tex: 'A v = \\lambda v', label: 'A v equals lambda v' }]} />)

    expect(screen.getByRole('math', { name: 'A v equals lambda v' })).toBeInTheDocument()
  })

  it('says what happened when a formula cannot be rendered, without colour', () => {
    render(<Prose blocks={[{ type: 'math', tex: '\\frac{' }]} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This formula could not be rendered. The source text is shown instead.',
    )
    expect(screen.getByText('\\frac{')).toBeInTheDocument()
  })

  it('highlights code through weight and italics, never through hue', () => {
    const { container } = render(
      <Prose
        blocks={[
          {
            type: 'code',
            language: 'python',
            code: 'def norm(v):  # length\n    return v',
          },
        ]}
      />,
    )

    const code = container.querySelector('code')
    expect(code.querySelector('.font-bold')).toHaveTextContent('def')
    const comment = code.querySelector('.italic')
    expect(comment).toHaveTextContent('# length')
    expect(comment).toHaveClass('text-ink-muted')
    expect(code.innerHTML).not.toMatch(/color:|text-(red|green|blue|amber)/)
  })

  it('lets a table break out of the measure, as the design allows', () => {
    const { container } = render(
      <Prose
        blocks={[
          {
            type: 'table',
            head: ['Term', 'Meaning'],
            rows: [['Rank', 'Dimension of the image']],
          },
        ]}
      />,
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Term' })).toBeInTheDocument()
    expect(container.querySelector('table')).not.toHaveClass('max-w-measure')
  })
})
