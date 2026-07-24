'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { renderInline } from './prose';
import { buttonClass, inputClass, normalise } from './control';

/* A sentence with its key terms taken out. The learner types them back and
   the artefact checks them. Right and wrong are carried by a word and a
   monochrome icon — there is no green field and no red one. */
export default function ClozeArtefact({ artefact, onAnswered }) {
  const { segments } = artefact.payload;
  const sources = artefact.sources ?? [];
  const blanks = segments.filter((segment) => segment.type === 'blank');

  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);

  function isRight(blank) {
    const given = normalise(answers[blank.id]);
    return [blank.answer, ...(blank.accept ?? [])].some(
      (candidate) => normalise(candidate) === given,
    );
  }

  const rightCount = blanks.filter(isRight).length;

  function check() {
    setChecked(true);
    onAnswered?.({
      artefactId: artefact.id,
      correct: rightCount === blanks.length,
      score: `${rightCount}/${blanks.length}`,
    });
  }

  function verdict() {
    if (rightCount < blanks.length) {
      return `${rightCount} of ${blanks.length} right. The answers you missed are shown below.`;
    }
    if (blanks.length === 1) return 'The blank is right.';
    if (blanks.length === 2) return 'Both blanks right.';
    return `All ${blanks.length} blanks right.`;
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-measure text-body leading-loose">
        {segments.map((segment, index) => {
          if (segment.type !== 'blank') {
            return (
              <span key={index}>{renderInline(segment.text, sources)}</span>
            );
          }

          const position = blanks.indexOf(segment) + 1;
          const right = checked && isRight(segment);

          return (
            <span key={segment.id} className="inline-flex items-baseline gap-2">
              <label className="sr-only" htmlFor={`${artefact.id}-${segment.id}`}>
                Missing word {position}
              </label>
              <input
                id={`${artefact.id}-${segment.id}`}
                type="text"
                autoComplete="off"
                value={answers[segment.id] ?? ''}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [segment.id]: event.target.value,
                  }))
                }
                readOnly={checked}
                className={`${inputClass} w-40 border-b-2 border-b-ink`}
              />
              {checked ? (
                right ? (
                  <Check size={16} strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <span className="inline-flex items-baseline gap-1 font-mono text-caption text-ink">
                    <X size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span>{segment.answer}</span>
                  </span>
                )
              ) : null}
            </span>
          );
        })}
      </p>

      {checked ? (
        <p
          role="status"
          className="flex max-w-measure items-baseline gap-2 text-body-s text-ink"
        >
          {rightCount === blanks.length ? (
            <Check size={18} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <X size={18} strokeWidth={1.5} aria-hidden="true" />
          )}
          <span>{verdict()}</span>
        </p>
      ) : (
        <div>
          <button type="button" onClick={check} className={buttonClass}>
            Check your answers
          </button>
        </div>
      )}
    </div>
  );
}
