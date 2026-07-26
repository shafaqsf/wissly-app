import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ListenControl from './listen-control'

/* jsdom carries no SpeechSynthesis implementation at all, so every test that
   wants the control to be "supported" has to stub one — and the one test
   that wants it unsupported has to make sure nothing is stubbed. */
function stubSpeechSynthesis() {
  const utterances = []

  class FakeUtterance {
    constructor(text) {
      this.text = text
    }
  }

  const synthesis = {
    speak: vi.fn((utterance) => utterances.push(utterance)),
    cancel: vi.fn(),
  }

  vi.stubGlobal('speechSynthesis', synthesis)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)

  return { synthesis, utterances }
}

describe('ListenControl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when the browser has no speech synthesis', () => {
    render(<ListenControl text="Read this aloud." />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders nothing when there is no text to read', () => {
    stubSpeechSynthesis()

    render(<ListenControl text="   " />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers a listen control once speech synthesis is available', async () => {
    stubSpeechSynthesis()

    render(<ListenControl text="Read this aloud." />)

    expect(await screen.findByRole('button', { name: /listen/i })).toBeInTheDocument()
  })

  it('speaks the given text when pressed', async () => {
    const { synthesis, utterances } = stubSpeechSynthesis()
    const user = userEvent.setup()
    render(<ListenControl text="Read this aloud." />)

    await user.click(await screen.findByRole('button', { name: /^listen$/i }))

    expect(synthesis.speak).toHaveBeenCalledTimes(1)
    expect(utterances[0].text).toBe('Read this aloud.')
  })

  it('stops when pressed again while speaking', async () => {
    const { synthesis } = stubSpeechSynthesis()
    const user = userEvent.setup()
    render(<ListenControl text="Read this aloud." />)

    await user.click(await screen.findByRole('button', { name: /^listen$/i }))
    expect(screen.getByRole('button', { name: /stop listening/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /stop listening/i }))

    expect(synthesis.cancel).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^listen$/i })).toBeInTheDocument()
  })
})
