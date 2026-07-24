import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Prose from './prose'

describe('Prose', () => {
  it('renders a paragraph of running text', () => {
    render(<Prose text="Eigenvectors keep their direction." />)

    expect(
      screen.getByText('Eigenvectors keep their direction.'),
    ).toBeInTheDocument()
  })

  it('holds running prose to the 66-character measure', () => {
    const { container } = render(<Prose text="Running text." />)

    expect(container.querySelector('p')).toHaveClass('max-w-measure')
  })

  it('breaks a payload into paragraphs on a blank line', () => {
    const { container } = render(<Prose text={'First point.\n\nSecond point.'} />)

    expect(container.querySelectorAll('p')).toHaveLength(2)
  })

  it('renders inline mathematics through KaTeX rather than as raw TeX', () => {
    const { container } = render(<Prose text="Take $Av = \lambda v$ here." />)

    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.textContent).not.toContain('\\lambda')
  })

  it('renders a display formula, and names it for a screen reader', () => {
    render(<Prose text={'Then:\n\n$$A v = \\lambda v$$'} />)

    expect(screen.getByRole('math', { name: 'A v = \\lambda v' })).toBeInTheDocument()
  })

  it('says what happened when a formula cannot be rendered, without colour', () => {
    render(<Prose text={'$$\\frac{$$'} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This formula could not be rendered. The source text is shown instead.',
    )
    expect(screen.getByText('\\frac{')).toBeInTheDocument()
  })

  it('highlights code through weight and italics, never through hue', () => {
    const { container } = render(
      <Prose text={'```python\ndef norm(v):  # length\n    return v\n```'} />,
    )

    const code = container.querySelector('code')
    expect(code.querySelector('.font-bold')).toHaveTextContent('def')
    const comment = code.querySelector('.italic')
    expect(comment).toHaveTextContent('# length')
    expect(comment).toHaveClass('text-ink-muted')
    expect(code.innerHTML).not.toMatch(/color:|text-(red|green|blue|amber)/)
  })

  it('lets a code block scroll rather than break the page at 360px', () => {
    const { container } = render(<Prose text={'```sql\nselect 1\n```'} />)

    expect(container.querySelector('pre')).toHaveClass('overflow-x-auto')
  })
})
