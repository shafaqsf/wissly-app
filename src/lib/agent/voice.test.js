import { describe, expect, it, vi } from 'vitest'

import {
  cancelSpeech,
  createSpeechRecognizer,
  speak,
  speakableText,
  speechSupport,
} from './voice.js'

describe('speechSupport', () => {
  it('reports both features unsupported with no window at all', () => {
    expect(speechSupport(undefined)).toEqual({ input: false, output: false })
  })

  it('reports both unsupported on a window with neither API', () => {
    expect(speechSupport({})).toEqual({ input: false, output: false })
  })

  it('finds the standard SpeechRecognition constructor', () => {
    expect(speechSupport({ SpeechRecognition: function Recognition() {} }).input).toBe(true)
  })

  it('finds the webkit-prefixed constructor Chrome actually ships', () => {
    expect(speechSupport({ webkitSpeechRecognition: function Recognition() {} }).input).toBe(true)
  })

  it('finds speechSynthesis for output', () => {
    expect(speechSupport({ speechSynthesis: {} }).output).toBe(true)
  })

  it('finds both independently, a browser is not all-or-nothing', () => {
    expect(
      speechSupport({ webkitSpeechRecognition: function Recognition() {}, speechSynthesis: {} }),
    ).toEqual({ input: true, output: true })
  })
})

/** A minimal stand-in for the constructor Chrome and Safari both ship. */
function fakeRecognitionConstructor() {
  const instances = [];
  function Recognition() {
    this.start = vi.fn()
    this.stop = vi.fn()
    this.abort = vi.fn()
    instances.push(this)
  }
  Recognition.instances = instances
  return Recognition
}

describe('createSpeechRecognizer', () => {
  it('returns null when the browser holds neither constructor — the fallback path', () => {
    expect(createSpeechRecognizer({})).toBeNull()
    expect(createSpeechRecognizer(undefined)).toBeNull()
  })

  it('builds one utterance at a time, with interim results on', () => {
    const SpeechRecognition = fakeRecognitionConstructor()
    createSpeechRecognizer({ SpeechRecognition }, { lang: 'de-DE' })

    const [instance] = SpeechRecognition.instances
    expect(instance.lang).toBe('de-DE')
    expect(instance.continuous).toBe(false)
    expect(instance.interimResults).toBe(true)
  })

  it('starts, stops and aborts the underlying recognizer', () => {
    const SpeechRecognition = fakeRecognitionConstructor()
    const recognizer = createSpeechRecognizer({ SpeechRecognition })
    const [instance] = SpeechRecognition.instances

    recognizer.start()
    recognizer.stop()
    recognizer.abort()

    expect(instance.start).toHaveBeenCalledTimes(1)
    expect(instance.stop).toHaveBeenCalledTimes(1)
    expect(instance.abort).toHaveBeenCalledTimes(1)
  })

  it('reports interim and final transcripts as they arrive', () => {
    const SpeechRecognition = fakeRecognitionConstructor()
    const onResult = vi.fn()
    createSpeechRecognizer({ SpeechRecognition }, { onResult })
    const [instance] = SpeechRecognition.instances

    instance.onresult({ results: [{ 0: { transcript: 'what is a mart' }, isFinal: false }] })
    instance.onresult({ results: [{ 0: { transcript: 'what is a martingale' }, isFinal: true }] })

    expect(onResult).toHaveBeenNthCalledWith(1, 'what is a mart', false)
    expect(onResult).toHaveBeenNthCalledWith(2, 'what is a martingale', true)
  })

  it('reports when listening ends and when it errors', () => {
    const SpeechRecognition = fakeRecognitionConstructor()
    const onEnd = vi.fn()
    const onError = vi.fn()
    createSpeechRecognizer({ SpeechRecognition }, { onEnd, onError })
    const [instance] = SpeechRecognition.instances

    instance.onend()
    instance.onerror({ error: 'not-allowed' })

    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith('not-allowed')
  })
})

/** A minimal stand-in for SpeechSynthesis + SpeechSynthesisUtterance. */
function fakeSynthWindow() {
  const spoken = []
  const synth = { cancel: vi.fn(), speak: vi.fn((utterance) => spoken.push(utterance)) }
  function SpeechSynthesisUtterance(text) {
    this.text = text
  }
  return { speechSynthesis: synth, SpeechSynthesisUtterance, spoken }
}

describe('speak', () => {
  it('returns false and speaks nothing when the browser cannot', () => {
    expect(speak({}, 'hello')).toBe(false)
    expect(speak(undefined, 'hello')).toBe(false)
  })

  it('returns false for empty text without touching the synthesiser', () => {
    const win = fakeSynthWindow()
    expect(speak(win, '   ')).toBe(false)
    expect(win.speechSynthesis.speak).not.toHaveBeenCalled()
  })

  it('speaks the text and reports success', () => {
    const win = fakeSynthWindow()
    expect(speak(win, 'A martingale is a fair game.')).toBe(true)
    expect(win.spoken[0].text).toBe('A martingale is a fair game.')
  })

  it('cancels whatever was already speaking before the next reply starts', () => {
    const win = fakeSynthWindow()
    speak(win, 'first')
    speak(win, 'second')

    expect(win.speechSynthesis.cancel).toHaveBeenCalledTimes(2)
    expect(win.spoken).toHaveLength(2)
  })
})

describe('cancelSpeech', () => {
  it('cancels ongoing speech', () => {
    const win = fakeSynthWindow()
    cancelSpeech(win)
    expect(win.speechSynthesis.cancel).toHaveBeenCalledTimes(1)
  })

  it('is safe to call with nothing to cancel', () => {
    expect(() => cancelSpeech(undefined)).not.toThrow()
    expect(() => cancelSpeech({})).not.toThrow()
  })
})

describe('speakableText', () => {
  it('strips citation markers, which are typography for the eye', () => {
    expect(speakableText('A fair game. [s:9f2a-11] And more. [s:abc]')).toBe(
      'A fair game. And more.',
    )
  })

  it('collapses the whitespace a stripped marker leaves behind', () => {
    expect(speakableText('One  [s:a]  two')).toBe('One two')
  })

  it('leaves ordinary prose alone', () => {
    expect(speakableText('No citations here.')).toBe('No citations here.')
  })
})
