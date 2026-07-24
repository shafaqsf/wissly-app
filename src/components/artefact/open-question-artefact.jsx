'use client';

import { useState } from 'react';
import Prose from './prose';
import { buttonClass } from './control';

/* Free text in, graded feedback back. The marking is the agent's, so this is
   the one artefact with a waiting state — and the waiting state is the only
   one the product has: grain-3 with drift, settling to grain-1. */

const VERDICTS = {
  right: 'Your answer covers it.',
  partly: 'Part of it is there.',
  wrong: 'That is not it yet.',
};

export default function OpenQuestionArtefact({ artefact, onGrade, onAnswered }) {
  const { prompt, expectedPoints } = artefact.payload;
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle');
  const [feedback, setFeedback] = useState(null);

  const pointName = (id) =>
    expectedPoints.find((point) => point.id === id)?.text ?? id;

  async function send() {
    setStatus('marking');
    try {
      const result = await onGrade(text);
      setFeedback(result);
      setStatus('marked');
      onAnswered?.({
        artefactId: artefact.id,
        correct: result.verdict === 'right',
        verdict: result.verdict,
      });
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Prose blocks={prompt} sources={artefact.sources} />

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
        <div
          className="grain grain-field grain-working flex min-h-32 items-center justify-center"
          style={{ '--grain': 'var(--grain-3)' }}
        >
          <p className="font-mono text-label uppercase text-ink-muted">
            Marking your answer
          </p>
        </div>
      ) : null}

      {status === 'failed' ? (
        <p
          role="alert"
          className="max-w-measure border-l-2 border-ink pl-4 text-body-s text-ink"
        >
          Your answer was not marked. Check your connection and send it again.
        </p>
      ) : null}

      {status === 'marked' && feedback ? (
        <div
          className="grain flex flex-col gap-4 border-t border-rule pt-6"
          style={{ '--grain': 'var(--grain-1)' }}
        >
          <p className="max-w-measure text-body">
            {VERDICTS[feedback.verdict] ?? VERDICTS.partly} {feedback.summary}
          </p>

          {feedback.covered?.length ? (
            <section className="flex flex-col gap-2">
              <h3 className="font-mono text-label uppercase text-ink-muted">
                You covered
              </h3>
              <ul className="flex max-w-measure list-none flex-col gap-1 text-body-s">
                {feedback.covered.map((id) => (
                  <li key={id}>{pointName(id)}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {feedback.missing?.length ? (
            <section className="flex flex-col gap-2">
              <h3 className="font-mono text-label uppercase text-ink-muted">
                Still missing
              </h3>
              <ul className="flex max-w-measure list-none flex-col gap-1 text-body-s">
                {feedback.missing.map((id) => (
                  <li key={id}>{pointName(id)}</li>
                ))}
              </ul>
            </section>
          ) : null}
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
