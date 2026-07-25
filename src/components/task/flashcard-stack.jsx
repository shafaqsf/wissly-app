'use client';

import { useState } from 'react';

import { buttonClass, quietButtonClass } from '@/components/artefact/control';
import CitationAnchor from '@/components/artefact/citation-anchor';
import Prose from '@/components/artefact/prose';

/* The stack: practice, without a schedule.

   This is not the review queue. Nothing here is rated and nothing here moves a
   due date — it is the pile on the desk, turned through to see what is in it.
   Rating lives in Due, where the FSRS state is read fresh before it is
   written.

   The card turns in three dimensions, which is the one movement in the product
   allowed a third one, because a card with two faces is a real object a
   learner already understands. Both faces are in the document so the turn has
   something to turn to; the one facing away is hidden from the screen reader,
   which reads the card the way the eye sees it. */
export default function FlashcardStack({ tasks = [] }) {
  const [index, setIndex] = useState(0);
  const [turned, setTurned] = useState(false);

  if (tasks.length === 0) return null;

  const card = tasks[Math.min(index, tasks.length - 1)];

  function step(by) {
    setTurned(false);
    setIndex((current) => (current + by + tasks.length) % tasks.length);
  }

  return (
    <section aria-label="Practice" className="flex flex-col gap-4">
      <p className="font-mono text-label uppercase text-ink-muted">
        {index + 1} of {tasks.length}
      </p>

      <div className="rounded-surface border border-rule p-6">
        <div
          className="motion-flip min-h-40"
          data-turned={turned ? 'true' : 'false'}
          data-testid="flashcard"
        >
          <div className="motion-flip-face flex flex-col gap-2" aria-hidden={turned}>
            <p className="font-mono text-label uppercase text-ink-muted">Front</p>
            <Prose text={card.payload.front} />
          </div>

          <div
            className="motion-flip-face flex flex-col gap-2"
            data-face="back"
            aria-hidden={!turned}
          >
            <p className="font-mono text-label uppercase text-ink-muted">Back</p>
            <Prose text={card.payload.back} />
            <p className="max-w-measure text-body-s text-ink-muted">
              From
              <CitationAnchor
                ordinal={card.section_ordinal}
                anchor={card.anchor}
                passage={card.passage}
              />
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTurned((it) => !it)} className={buttonClass}>
          {turned ? 'Show the front' : 'Turn the card'}
        </button>
        <button type="button" onClick={() => step(-1)} className={quietButtonClass}>
          Previous
        </button>
        <button type="button" onClick={() => step(1)} className={quietButtonClass}>
          Next
        </button>
      </div>
    </section>
  );
}
