'use client';

import { useState } from 'react';
import { averageMastery, masteryState } from '@/lib/mastery';
import { quietButtonClass } from '@/components/artefact/control';

/* Progress, as one grain field.

   DESIGN.md allows exactly one grain field per viewport, and a list of
   concepts wants one per row. The resolution: the field belongs to whatever
   the learner is looking at — the subject to begin with, a single concept
   once one is picked — and the list carries its states in words. The words
   and the field say the same thing; only the field is a field. */
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
        className="grain grain-field flex min-h-64 flex-col items-center justify-center gap-2 px-6 py-12 text-center"
        style={{ '--grain': state.grain }}
      >
        <h2 className="font-display text-display-l font-bold">{heading}</h2>
        <p className="font-mono text-label uppercase text-ink-muted">
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
                  className="flex min-h-11 w-full items-baseline justify-between gap-4 border-b border-rule py-3 text-left"
                >
                  <span className="text-body">{concept.name}</span>
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
