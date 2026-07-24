'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import Prose, { renderInline } from './prose';
import { buttonClass } from './control';

/* Options, a choice, then the reason each distractor was wrong. The reasons
   are the point of the format — a learner who guesses right for the wrong
   reason has learnt nothing — so every one of them is shown, not only the
   reason belonging to the option that was picked. */
export default function MultipleChoiceArtefact({ artefact, onAnswered }) {
  const { stem, options } = artefact.payload;
  const sources = artefact.sources ?? [];
  const [choiceId, setChoiceId] = useState(null);
  const [checked, setChecked] = useState(false);

  const answer = options.find((option) => option.correct);
  const choice = options.find((option) => option.id === choiceId);

  function check() {
    setChecked(true);
    onAnswered?.({
      artefactId: artefact.id,
      correct: Boolean(choice?.correct),
      choiceId,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Prose blocks={stem} sources={sources} />

      <div
        role="radiogroup"
        aria-label="Your answer"
        className="flex max-w-measure flex-col"
      >
        {options.map((option) => (
          <label
            key={option.id}
            className="flex min-h-11 cursor-pointer items-baseline gap-3 border-b border-rule py-3 text-body"
          >
            <input
              type="radio"
              name={`${artefact.id}-choice`}
              value={option.id}
              checked={option.id === choiceId}
              disabled={checked}
              onChange={() => setChoiceId(option.id)}
              className="accent-ink"
            />
            <span className="flex-1">{option.text}</span>
            {checked ? (
              option.correct ? (
                <Check size={18} strokeWidth={1.5} aria-hidden="true" />
              ) : option.id === choiceId ? (
                <X size={18} strokeWidth={1.5} aria-hidden="true" />
              ) : null
            ) : null}
          </label>
        ))}
      </div>

      {checked ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="max-w-measure text-body">
            {choice?.correct
              ? 'Right.'
              : `Not right. The answer is "${answer.text}".`}
          </p>

          <div className="flex flex-col gap-3">
            <h3 className="font-mono text-label uppercase text-ink-muted">
              Why each option stands or falls
            </h3>
            <dl className="flex max-w-measure flex-col gap-3">
              {options.map((option) => (
                <div key={option.id} className="flex flex-col gap-1">
                  <dt className="font-mono text-caption text-ink-muted">
                    {option.text}
                  </dt>
                  <dd className="text-body-s">
                    {renderInline(option.reason, sources)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={check}
            disabled={!choice}
            className={buttonClass}
          >
            Check your answer
          </button>
        </div>
      )}
    </div>
  );
}
