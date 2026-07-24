'use client';

import { useState } from 'react';

/* Every generated claim points back at the passage it came from. The anchor is
   a superscript mono numeral — the smallest mark that can carry a number —
   and activating it opens the source, in place, under the claim.

   An anchor is `{ page }` when the source was a PDF and `{ start, end,
   heading? }` when it was pasted text. Both have to read as a place a person
   can find again, so both get words rather than a raw offset. */

export function describeAnchor(anchor) {
  if (!anchor) return 'source unknown';
  if (anchor.page != null) return `page ${anchor.page}`;

  const range = `characters ${anchor.start}–${anchor.end}`;
  return anchor.heading ? `${anchor.heading}, ${range}` : range;
}

export default function CitationAnchor({ ordinal, anchor, passage }) {
  const [open, setOpen] = useState(false);

  if (ordinal == null) return null;

  const where = describeAnchor(anchor);

  return (
    <span className="inline">
      <sup className="leading-none">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={`Source ${ordinal}, ${where}`}
          // A numeral cannot be 44px tall without wrecking the line it sits
          // in, so the tap target is grown around it instead — see `.tap-44`.
          className="tap-44 relative mx-0.5 inline-flex items-center justify-center rounded-control font-mono text-caption text-ink underline decoration-rule underline-offset-2 hover:decoration-ink"
        >
          {ordinal}
        </button>
      </sup>

      {open ? (
        <span className="mt-3 mb-3 block max-w-measure border border-rule bg-paper-sunk px-4 py-3">
          <span className="block font-mono text-label uppercase text-ink-muted">
            Source {ordinal}
          </span>
          <span className="mt-1 block font-mono text-caption text-ink-muted">
            {where}
          </span>
          {passage ? (
            <q className="mt-2 block text-body-s text-ink">{passage}</q>
          ) : (
            <span className="mt-2 block text-body-s text-ink">
              Open the section at {where} to read the passage.
            </span>
          )}
        </span>
      ) : null}
    </span>
  );
}
