'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import Prose, { renderInline } from './prose';
import CitationAnchor from './citation-anchor';
import { buttonClass } from './control';

/* Options, a choice, then the reason each option stands or falls. The
   payload carries a rationale for every option in option order, including
   the right one — a learner who guessed correctly for the wrong reason has
   learnt nothing — so all of them are shown, and none before the answer. */
export default function MultipleChoiceArtefact({ artefact, onAnswered }) {
  const { stem, options, answer_index: answerIndex, rationales } = artefact.payload;
  const [choice, setChoice] = useState(null);
  const [checked, setChecked] = useState(false);

  function check() {
    setChecked(true);
    onAnswered?.({
      artefactId: artefact.id,
      correct: choice === answerIndex,
      choiceIndex: choice,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Prose text={stem} />

      <div
        role="radiogroup"
        aria-label="Your answer"
        className="flex max-w-measure flex-col"
      >
        {options.map((option, index) => (
          <label
            key={option}
            className="flex min-h-11 cursor-pointer items-baseline gap-3 border-b border-rule py-3 text-body"
          >
            <input
              type="radio"
              name={`${artefact.id}-choice`}
              value={index}
              checked={index === choice}
              disabled={checked}
              onChange={() => setChoice(index)}
              // Chrome keeps its own widget geometry at `appearance: auto`
              // and drops an author radius with it, so the focus ring came
              // out square around a round control. Drawn here instead: an
              // empty ink ring that fills when chosen, which is the legend a
              // field mark already uses.
              className="size-4 shrink-0 appearance-none rounded-round border border-ink bg-paper checked:bg-ink"
            />
            <span className="flex-1">{option}</span>
            {checked ? (
              index === answerIndex ? (
                <Check size={18} strokeWidth={1.5} aria-hidden="true" />
              ) : index === choice ? (
                <X size={18} strokeWidth={1.5} aria-hidden="true" />
              ) : null
            ) : null}
          </label>
        ))}
      </div>

      {checked ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="max-w-measure text-body">
            {choice === answerIndex
              ? 'Right.'
              : `Not right. The answer is "${options[answerIndex]}".`}
          </p>

          <div className="flex flex-col gap-3">
            <h3 className="font-mono text-label uppercase text-ink-muted">
              Why each option stands or falls
            </h3>
            <dl className="flex max-w-measure flex-col gap-3">
              {options.map((option, index) => (
                <div key={option} className="flex flex-col gap-1">
                  <dt className="font-mono text-caption text-ink-muted">
                    {option}
                  </dt>
                  <dd className="text-body-s">
                    {renderInline(rationales[index])}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

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
          <button
            type="button"
            onClick={check}
            disabled={choice === null}
            className={buttonClass}
          >
            Check your answer
          </button>
        </div>
      )}
    </div>
  );
}
