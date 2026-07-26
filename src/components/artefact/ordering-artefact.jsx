'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { renderInline } from './prose';
import CitationAnchor from './citation-anchor';
import { buttonClass, quietButtonClass } from './control';

/* The payload keeps `items` in their correct order — the UI shuffles a copy
   for the learner to rearrange and grades it against the original, so no
   second "shuffled" field has to be kept in step with the first. The shuffle
   is a plain reverse rather than a random one: a reproducible starting point
   for anyone reading the same artefact twice, tests included. */
function shuffled(items) {
  return [...items].reverse();
}

export default function OrderingArtefact({ artefact, onAnswered }) {
  const { prompt, items, rationale } = artefact.payload;
  const [order, setOrder] = useState(() => shuffled(items));
  const [checked, setChecked] = useState(false);

  const correct = order.join('|') === items.join('|');

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;

    setOrder((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function check() {
    setChecked(true);
    onAnswered?.({ artefactId: artefact.id, correct });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-measure text-body">{renderInline(prompt)}</p>

      <ol className="flex max-w-measure flex-col gap-2">
        {order.map((item, index) => (
          <li
            key={item}
            className="flex min-h-11 items-center gap-3 border-b border-rule py-2 text-body"
          >
            <span className="flex-1">{item}</span>
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={checked || index === 0}
              aria-label={`Move "${item}" up`}
              className={quietButtonClass}
            >
              <ArrowUp size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={checked || index === order.length - 1}
              aria-label={`Move "${item}" down`}
              className={quietButtonClass}
            >
              <ArrowDown size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>

      {checked ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="max-w-measure text-body">
            {correct ? 'Right.' : 'Not right.'}
          </p>

          {!correct ? <p className="max-w-measure text-body-s">{renderInline(rationale)}</p> : null}

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
          <button type="button" onClick={check} className={buttonClass}>
            Check the order
          </button>
        </div>
      )}
    </div>
  );
}
