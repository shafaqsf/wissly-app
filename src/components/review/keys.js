'use client';

import { useEffect } from 'react';

/* The keyboard round.

   A daily surface that needs a mouse does not get used daily, so the whole
   round is reachable without one: Space turns the card, 1 to 4 rate it and
   move on, Enter advances the card through whichever step it is at.

   The keys are only listened for on the page, never inside a control. A cloze
   is answered by typing and a multiple choice by choosing, so a global "3
   means comfortably" would eat the learner's own keystrokes. Anything with its
   own key behaviour — a field, a button, a link, a select — keeps it. */

const TYPES = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A']);

function ownsItsKeys(element) {
  if (!element || element === document.body) return false;
  if (element.isContentEditable) return true;
  return TYPES.has(element.tagName);
}

export function useReviewKeys({ onTurn, onRate, enabled = true }) {
  useEffect(() => {
    if (!enabled) return undefined;

    function handle(event) {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (ownsItsKeys(event.target)) return;

      if (event.key === ' ' || event.key === 'Enter') {
        // Space scrolls the page by default, which is the last thing a round
        // wants between the front of a card and its back.
        event.preventDefault();
        onTurn?.();
        return;
      }

      if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        onRate?.(Number(event.key));
      }
    }

    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [enabled, onTurn, onRate]);
}
