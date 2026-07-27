'use client';

/**
 * Voice mode: the browser-native Web Speech API, and nothing else.
 *
 * Zero external accounts, zero network calls of its own — `SpeechRecognition`
 * turns the microphone into text locally (or via the browser's own service;
 * either way it is the browser's concern, not this product's), and
 * `SpeechSynthesis` turns text back into sound. Neither is standardised
 * evenly: Chrome ships `webkitSpeechRecognition`, Firefox ships neither as of
 * this writing, and a browser with no microphone permission granted yet still
 * exposes the constructor. So every function here is a pure wrapper over an
 * injected `window`-like object rather than a hook that reaches for the
 * global directly — that is what lets the fallback path be tested without a
 * browser that actually has the API, and it is why nothing here assumes the
 * global exists.
 *
 * Every export degrades the same way: missing support is a `null` or a
 * `false`, never a thrown error. A learner without Chrome should see no mic
 * button, not a crashed agent bar.
 */

/** @param {Window} [win] @returns {{input: boolean, output: boolean}} */
export function speechSupport(win) {
  if (!win) return { input: false, output: false };

  return {
    input: typeof (win.SpeechRecognition ?? win.webkitSpeechRecognition) === 'function',
    output: typeof win.speechSynthesis === 'object' && win.speechSynthesis !== null,
  };
}

/**
 * Build a recognizer bound to one utterance at a time. `null` when the
 * browser holds neither constructor — the caller's whole reason to check
 * `speechSupport` first rather than call this blind.
 *
 * @param {Window} win
 * @param {object} [options]
 * @param {string} [options.lang]
 * @param {(text: string, isFinal: boolean) => void} [options.onResult]
 * @param {() => void} [options.onEnd]
 * @param {(error: unknown) => void} [options.onError]
 * @returns {{start: () => void, stop: () => void, abort: () => void}|null}
 */
export function createSpeechRecognizer(win, { lang = 'en-US', onResult, onEnd, onError } = {}) {
  const Recognition = win?.SpeechRecognition ?? win?.webkitSpeechRecognition;
  if (typeof Recognition !== 'function') return null;

  const recognizer = new Recognition();
  recognizer.lang = lang;
  recognizer.continuous = false;
  recognizer.interimResults = true;

  recognizer.onresult = (event) => {
    const result = event.results?.[event.results.length - 1];
    const text = result?.[0]?.transcript ?? '';
    onResult?.(text, Boolean(result?.isFinal));
  };
  recognizer.onerror = (event) => onError?.(event?.error ?? event);
  recognizer.onend = () => onEnd?.();

  return {
    start: () => recognizer.start(),
    stop: () => recognizer.stop(),
    abort: () => recognizer.abort(),
  };
}

/**
 * Speak text aloud. `false` when the browser cannot — the caller's signal to
 * fall back to silence rather than assume the reply was heard.
 *
 * Any utterance already speaking is cancelled first: a second reply landing
 * while the first is still being read out should replace it, not queue
 * behind it and read two answers back to back out of order with what is on
 * screen by the time the second one starts.
 *
 * @param {Window} win
 * @param {string} text
 * @param {{lang?: string, onEnd?: () => void}} [options]
 * @returns {boolean}
 */
export function speak(win, text, { lang, onEnd } = {}) {
  const synth = win?.speechSynthesis;
  if (!synth || typeof win.SpeechSynthesisUtterance !== 'function') return false;

  const spoken = String(text ?? '').trim();
  if (spoken === '') return false;

  synth.cancel();

  const utterance = new win.SpeechSynthesisUtterance(spoken);
  if (lang) utterance.lang = lang;
  if (onEnd) utterance.onend = onEnd;

  synth.speak(utterance);
  return true;
}

/** Stop whatever is being read out. Safe to call when nothing is. */
export function cancelSpeech(win) {
  win?.speechSynthesis?.cancel?.();
}

/**
 * What the bar reads aloud is not what the transcript prints. Citation
 * markers (`[s:SECTION_ID]`) are typography for the eye — a superscript
 * numeral a learner can open — and read literally they are noise no listener
 * asked for.
 *
 * @param {string} text
 */
export function speakableText(text) {
  return String(text ?? '')
    .replace(/\[s:[0-9a-zA-Z-]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
