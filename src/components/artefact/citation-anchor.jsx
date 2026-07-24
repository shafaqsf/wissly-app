'use client';

import { useState } from 'react';

/* Every generated claim points back at the passage it came from. The anchor is
   a superscript mono numeral — the smallest mark that can carry a number —
   and activating it opens the source itself, in place, under the sentence. */
export default function CitationAnchor({ source }) {
  const [open, setOpen] = useState(false);

  if (!source) return null;

  const { number, label, passage, anchor } = source;

  return (
    <span className="inline">
      <sup className="leading-none">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={`Source ${number}, ${label}`}
          // A numeral cannot be 44px tall without wrecking the line it sits
          // in, so the tap target is grown around it instead — see `.tap-44`.
          className="tap-44 relative mx-0.5 inline-flex items-center justify-center rounded-control font-mono text-caption text-ink underline decoration-rule underline-offset-2 hover:decoration-ink"
        >
          {number}
        </button>
      </sup>

      {open ? (
        <span className="mt-3 mb-3 block max-w-measure border border-rule bg-paper-sunk px-4 py-3">
          <span className="mb-2 flex items-baseline gap-2 font-mono text-label uppercase text-ink-muted">
            <span>Source {number}</span>
            {anchor ? <span aria-hidden="true">·</span> : null}
            {anchor ? <span className="normal-case">{anchor}</span> : null}
          </span>
          <span className="block font-mono text-caption text-ink-muted">
            {label}
          </span>
          <q className="mt-2 block text-body-s text-ink">{passage}</q>
        </span>
      ) : null}
    </span>
  );
}
