'use client';

import { useState } from 'react';
import { averageMastery, masteryState } from '@/lib/mastery';
import { quietButtonClass } from '@/components/artefact/control';

/* Progress, as a column of marks and one heading that wears the same mark.

   The heading used to sit on a tinted surface — a full-width band that got
   greyer the less the learner knew. It was the page's background, and it said
   what the two words under it already said. Now the subject wears a mark, the
   same one its concepts wear, at the size a heading can carry. Picking a
   concept is still the settle, in the open: the mark travels to its new fill
   over 600ms while the grain clears with it. */
export default function ConceptMastery({ subject, concepts = [] }) {
  const [selectedId, setSelectedId] = useState(null);

  const selected = concepts.find((concept) => concept.id === selectedId);
  const mastery = selected ? selected.mastery : averageMastery(concepts);
  const state = masteryState(mastery);
  const heading = selected ? selected.name : subject;

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-label="Mastery"
        className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center"
      >
        <h2 className="font-display text-display-l font-bold">{heading}</h2>
        {/* The same mark the rows below wear, so the heading and the list are
            one legend rather than two ways of saying the state. */}
        <p className="flex items-center gap-3 font-mono text-label uppercase text-ink">
          <span
            aria-hidden="true"
            className={`grain grain-mark ${state.field}`}
            style={{ '--grain': state.grain }}
          />
          {state.label}
        </p>
        {selected ? (
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className={`${quietButtonClass} mt-4`}
          >
            Show the whole subject
          </button>
        ) : null}
      </section>

      {concepts.length === 0 ? (
        <p className="max-w-measure text-body">
          No concepts yet. Add material and this subject will start to clear.
        </p>
      ) : (
        <ul aria-label="Concepts" className="flex flex-col border-t border-rule">
          {concepts.map((concept) => {
            const conceptState = masteryState(concept.mastery);

            return (
              <li key={concept.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(concept.id)}
                  aria-pressed={concept.id === selectedId}
                  aria-label={`${concept.name}, ${conceptState.label.toLowerCase()}`}
                  className="flex min-h-11 w-full items-center justify-between gap-4 border-b border-rule py-3 text-left"
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`grain grain-mark ${conceptState.field}`}
                      style={{ '--grain': conceptState.grain }}
                    />
                    <span className="text-body">{concept.name}</span>
                  </span>
                  <span className="font-mono text-caption uppercase text-ink-muted">
                    {conceptState.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
