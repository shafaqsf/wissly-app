'use client';

import { useState } from 'react';
import Artefact from '@/components/artefact/artefact';
import RatingButtons from './rating-buttons';

/* The daily surface: what is due, one artefact at a time.

   Position in the queue is a count, not progress — mastery is the only
   progress display in the product and it is carried by grain elsewhere. So
   there is no bar here and no percentage. */
export default function ReviewQueue({ artefacts = [], onRate, onGrade }) {
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(null);

  const artefact = artefacts[index];

  function rate(grade) {
    onRate?.({
      artefactId: artefact.id,
      conceptId: artefact.conceptId,
      rating: grade,
      answer: answered,
    });
    setAnswered(null);
    setIndex((current) => current + 1);
  }

  if (artefacts.length === 0) {
    return (
      <div
        className="grain grain-field field-unresolved flex flex-col items-center justify-center gap-3 rounded-surface px-6 py-12 text-center"
        style={{ '--grain': 'var(--grain-3)' }}
      >
        <p className="max-w-measure text-body">
          Nothing is due right now. Add material and the first review will
          appear here.
        </p>
      </div>
    );
  }

  if (!artefact) {
    return (
      <div
        // The one place the product says well done. `--grain-0` alone renders
        // nothing, so the arrival used to look like a blank div; the settled
        // field gives it a surface to land on.
        className="grain grain-field field-settled flex flex-col items-center justify-center gap-3 rounded-surface px-6 py-12 text-center"
        style={{ '--grain': 'var(--grain-0)' }}
      >
        <p className="max-w-measure text-body">
          That is today done. You reviewed {artefacts.length}{' '}
          {artefacts.length === 1 ? 'artefact' : 'artefacts'}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="font-mono text-label uppercase text-ink-muted">
        {index + 1} of {artefacts.length} due
      </p>

      <Artefact
        // A fresh instance per artefact: a revealed card must not hand its
        // revealed state to the next one.
        key={artefact.id}
        artefact={artefact}
        // The renderer knows the answer but not which artefact it belongs to.
        // Naming it here is what lets marking be a server action.
        onGrade={(answer) => onGrade?.({ artefactId: artefact.id, answer })}
        onAnswered={setAnswered}
      />

      {answered ? <RatingButtons onRate={rate} /> : null}
    </div>
  );
}
