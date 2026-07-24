'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { CLOZE_BLANK } from '@/lib/agent/formats';
import { renderInline } from './prose';
import CitationAnchor from './citation-anchor';
import { buttonClass, inputClass, normalise } from './control';

/* A sentence with one term taken out. The learner types it back and the
   artefact checks it. Right and wrong are carried by a word and a monochrome
   icon — there is no green field and no red one.

   The blank marker comes from the format contract rather than from a string
   here, so the two cannot drift apart. */
export default function ClozeArtefact({ artefact, onAnswered }) {
  const { text, answer } = artefact.payload;
  const [given, setGiven] = useState('');
  const [checked, setChecked] = useState(false);

  const [before, after = ''] = text.split(CLOZE_BLANK);
  const right = normalise(given) === normalise(answer);
  const inputId = `${artefact.id}-blank`;

  function check() {
    setChecked(true);
    onAnswered?.({ artefactId: artefact.id, correct: right, given });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-measure text-body leading-loose">
        {renderInline(before)}
        <span className="inline-flex items-baseline gap-2">
          <label className="sr-only" htmlFor={inputId}>
            The missing word
          </label>
          <input
            id={inputId}
            type="text"
            autoComplete="off"
            value={given}
            readOnly={checked}
            onChange={(event) => setGiven(event.target.value)}
            className={`${inputClass} w-48 border-b-2 border-b-ink`}
          />
          {checked ? (
            right ? (
              <Check size={16} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <X size={16} strokeWidth={1.5} aria-hidden="true" />
            )
          ) : null}
        </span>
        {renderInline(after)}
      </p>

      {checked ? (
        <div className="flex flex-col gap-2">
          <p
            role="status"
            className="flex max-w-measure items-baseline gap-2 text-body"
          >
            {right ? 'Right.' : `Not right. The word is "${answer}".`}
          </p>
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
            disabled={given.trim().length === 0}
            className={buttonClass}
          >
            Check your answer
          </button>
        </div>
      )}
    </div>
  );
}
