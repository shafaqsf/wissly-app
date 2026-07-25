'use client';

import { useState } from 'react';
import { Check, Minus, X } from 'lucide-react';
import Prose from './prose';
import CitationAnchor from './citation-anchor';
import { buttonClass, quietButtonClass } from './control';

/* Free text in, graded feedback back. The marking is the agent's, so this is
   the one artefact with a waiting state — and the waiting state is the only
   one the product has: grain-3 with drift, settling to grain-1.

   The grade is `{ verdict, score, missing, feedback }` and is never stored on
   the artefact. `missing` is the substance of it: what the answer left out,
   in the words of the criteria. */

const VERDICTS = {
  correct: { label: 'Your answer covers it.', Icon: Check },
  partial: { label: 'Part of it is there.', Icon: Minus },
  incorrect: { label: 'That is not it yet.', Icon: X },
};

export default function OpenQuestionArtefact({ artefact, onGrade, onAnswered }) {
  const { prompt, model_answer: modelAnswer } = artefact.payload;
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle');
  const [grade, setGrade] = useState(null);
  const [showModel, setShowModel] = useState(false);

  async function send() {
    setStatus('marking');
    try {
      const result = await onGrade(text);
      setGrade(result);
      setStatus('marked');
      onAnswered?.({
        artefactId: artefact.id,
        correct: result.verdict === 'correct',
        verdict: result.verdict,
        score: result.score,
      });
    } catch {
      setStatus('failed');
    }
  }

  const verdict = grade ? VERDICTS[grade.verdict] ?? VERDICTS.partial : null;

  return (
    <div className="flex flex-col gap-6">
      <Prose text={prompt} />

      <div className="flex max-w-measure flex-col gap-2">
        <label
          htmlFor={`${artefact.id}-answer`}
          className="font-mono text-label uppercase text-ink-muted"
        >
          Your answer
        </label>
        <textarea
          id={`${artefact.id}-answer`}
          rows={6}
          value={text}
          readOnly={status === 'marking' || status === 'marked'}
          onChange={(event) => setText(event.target.value)}
          className="rounded-control border border-rule bg-paper p-3 text-body text-ink"
        />
      </div>

      {status === 'marking' ? (
        /* A mark beside the words. The answer box above is a form, and a field
           never sits below one — the mark carries the same unresolved state at
           a size that does not push the answer off the screen. */
        <p className="flex items-center gap-3 font-mono text-label uppercase text-ink">
          <span
            aria-hidden="true"
            className="grain grain-mark grain-working field-unresolved"
            style={{ '--grain': 'var(--grain-3)' }}
          />
          Marking your answer
        </p>
      ) : null}

      {status === 'failed' ? (
        <p
          role="alert"
          className="max-w-measure border-l-2 border-ink pl-4 text-body-s text-ink"
        >
          Your answer was not marked. Check your connection and send it again.
        </p>
      ) : null}

      {status === 'marked' && grade ? (
        <div
          // Clean paper. Grain with no field is texture with no state behind
          // it, and the two are one axis.
          className={[
            'flex flex-col gap-4 pt-6',
            grade.verdict === 'incorrect'
              ? 'border-l-2 border-ink pl-4'
              : 'border-t border-rule',
          ].join(' ')}
        >
          <p role="status" className="flex max-w-measure items-baseline gap-2 text-body">
            <verdict.Icon size={18} strokeWidth={1.5} aria-hidden="true" />
            <span>{verdict.label}</span>
          </p>

          <p className="max-w-measure text-body">{grade.feedback}</p>

          {grade.missing?.length ? (
            <section className="flex flex-col gap-2">
              <h3 className="font-mono text-label uppercase text-ink-muted">
                Still missing
              </h3>
              <ul className="flex max-w-measure list-none flex-col gap-1 text-body-s">
                {grade.missing.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {showModel ? (
            <section className="flex flex-col gap-2">
              <h3 className="font-mono text-label uppercase text-ink-muted">
                A full answer
              </h3>
              <Prose text={modelAnswer} />
            </section>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setShowModel(true)}
                className={quietButtonClass}
              >
                Show a full answer
              </button>
            </div>
          )}

          <p className="max-w-measure text-body-s text-ink-muted">
            From
            <CitationAnchor
              ordinal={artefact.section_ordinal}
              anchor={artefact.anchor}
              passage={artefact.passage}
            />
          </p>
        </div>
      ) : null}

      {status === 'idle' || status === 'failed' ? (
        <div>
          <button
            type="button"
            onClick={send}
            disabled={text.trim().length === 0}
            className={buttonClass}
          >
            Send your answer
          </button>
        </div>
      ) : null}
    </div>
  );
}
