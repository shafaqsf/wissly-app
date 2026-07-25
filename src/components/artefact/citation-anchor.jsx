'use client';

import { useState } from 'react';

import { describeAnchor, sectionHref } from './anchor';

/* Every generated claim points back at the passage it came from. The anchor is
   a superscript mono numeral — the smallest mark that can carry a number —
   activating it opens the source in place under the claim, and the panel it
   opens carries a link on to the section itself on the course shelf.

   Two things read the passage: the eye, here, and the shelf, over there. The
   inline quotation answers "what did this come from"; the link answers "and
   where does it live". A quotation with no way back to the shelf is still a
   dead end. */

// Re-exported so that everything already importing these from here keeps
// working. They live in `anchor.js` because the server needs them too.
export { describeAnchor, sectionHref };

export default function CitationAnchor({ ordinal, anchor, passage, href }) {
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
        <span className="mt-3 mb-3 block max-w-measure rounded-surface border border-rule bg-paper-sunk px-4 py-3">
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
          {href ? (
            // The passage in place answers "what did this come from"; the link
            // answers "and where does it live". Both are needed — a quotation
            // with no way back to the shelf is still a dead end.
            <a
              href={href}
              className="mt-3 inline-flex min-h-11 items-center rounded-control font-mono text-label uppercase text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
            >
              Open the section
            </a>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
