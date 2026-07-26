'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { quietButtonClass } from './control';

/* Audio summaries. The browser reads a passage aloud with the Web Speech
   API's `SpeechSynthesis` — no account, no key, no request ever leaves the
   browser. Where the API is missing (an older browser, a locked-down
   webview) the control renders nothing rather than a button that does
   nothing when pressed: a graceful no-op, not a broken one.

   Support is read with `useSyncExternalStore` rather than a `useState` set
   from inside an effect: the API never changes after the page loads, so
   there is nothing to subscribe to, but the pattern is still the right one —
   it is what lets the answer differ between the server snapshot (always
   "no", since `window` does not exist there) and the client's without
   `setState` cascading a second render or a hydration warning either way. */
function subscribeToNothing() {
  return () => {};
}

function speechSynthesisIsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function unsupportedOnTheServer() {
  return false;
}

export default function ListenControl({ text }) {
  const supported = useSyncExternalStore(
    subscribeToNothing,
    speechSynthesisIsSupported,
    unsupportedOnTheServer,
  );
  const [speaking, setSpeaking] = useState(false);

  // Leaving the page mid-sentence should not leave the browser talking to an
  // empty room.
  useEffect(
    () => () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  const body = String(text ?? '').trim();
  if (!supported || body === '') return null;

  function toggle() {
    const synthesis = window.speechSynthesis;

    if (speaking) {
      synthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new window.SpeechSynthesisUtterance(body);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    synthesis.cancel(); // one voice at a time, even if something else was mid-sentence
    synthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={speaking} className={quietButtonClass}>
      {speaking ? (
        <VolumeX aria-hidden="true" size={16} strokeWidth={1.5} />
      ) : (
        <Volume2 aria-hidden="true" size={16} strokeWidth={1.5} />
      )}
      {speaking ? 'Stop listening' : 'Listen'}
    </button>
  );
}
