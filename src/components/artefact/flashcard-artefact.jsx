'use client';

import { useState } from 'react';
import Prose from './prose';
import CitationAnchor from './citation-anchor';
import { buttonClass } from './control';

/* Front, reveal, back. The reveal is the whole mechanism: recall has to be
   attempted before it can be checked, so the back does not exist in the
   document until the learner asks for it.

   `turned` is optional. Left out, the card holds its own state and the button
   is the only way to turn it. Passed in, the caller holds it — which is what
   lets Space turn the card in the review round, where the key is pressed on
   the page rather than on the button. */
export default function FlashcardArtefact({ artefact, onAnswered, turned, onTurn }) {
  const [own, setOwn] = useState(false);
  const controlled = turned !== undefined;
  const revealed = controlled ? turned : own;
  const { front, back } = artefact.payload;

  function reveal() {
    if (controlled) {
      onTurn?.();
      return;
    }

    setOwn(true);
    // A flashcard cannot mark itself: the learner rates it afterwards. What
    // the queue needs to know is only that the attempt happened.
    onAnswered?.({ artefactId: artefact.id, correct: null });
  }

  return (
    <div className="flex flex-col gap-6">
      <Prose text={front} />

      {revealed ? (
        <div className="flex flex-col gap-2 border-t border-rule pt-6">
          <p className="font-mono text-label uppercase text-ink-muted">Answer</p>
          <Prose text={back} />
          <p className="max-w-measure text-body-s text-ink-muted">
            From
            <CitationAnchor
              ordinal={artefact.section_ordinal}
              anchor={artefact.anchor}
              passage={artefact.passage}
            />
          </p>
        </div>
      ) : (
        <div>
          <button type="button" onClick={reveal} className={buttonClass}>
            Show the answer
          </button>
        </div>
      )}
    </div>
  );
}
