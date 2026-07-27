/* Small, hand-drawn illustrations for an empty list — task item 7 in v0.15.
   A bare sentence is still what carries the meaning ("Empty states are an
   invitation to act, not an apology for emptiness"); this sits beside it the way a mark sits beside a word, and
   is never the only thing on the screen that says a list is empty.

   These are not Lucide icons and this file does not pretend they are: Lucide
   is reserved for controls and glyphs that carry a fixed, small meaning. An illustration is decoration for a
   moment that has none yet, drawn once, larger, and it is the second named
   exception to "no colour in the chrome" after the mark: one ink line and one
   accent shape, never a second hue and never a fill on the ink line itself.

   `EmptyState` in `empty-state.jsx` is the only place any of these are
   composed; nothing else names this file. */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/** A shelf with one book leaning — courses, and material shelved under one. */
function Shelf(props) {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" {...props}>
      <path d="M10 58h52" {...STROKE} />
      <path d="M16 58V22a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v36" {...STROKE} />
      <path d="M38 58V30l12-6a2 2 0 0 1 2.8 1.8V52a2 2 0 0 1-1.3 1.9L38 58" {...STROKE} />
      <circle cx="56" cy="20" r="4" fill="currentColor" className="text-accent" />
    </svg>
  );
}

/** A magnifying glass over a short, trailing line — a search with nothing
 * behind it yet. */
function Search(props) {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" {...props}>
      <circle cx="30" cy="30" r="16" {...STROKE} />
      <path d="M42 42 58 58" {...STROKE} />
      <path d="M22 30h16M30 22v16" {...STROKE} />
      <circle cx="30" cy="30" r="3" fill="currentColor" className="text-accent" />
    </svg>
  );
}

/** A short checklist, one row ticked — tasks with nothing written yet. */
function Checklist(props) {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" {...props}>
      <rect x="14" y="12" width="44" height="48" rx="4" {...STROKE} />
      <path d="M22 26h20M22 36h20M22 46h12" {...STROKE} />
      <path d="M46 42.5 49.5 46 55 39" {...STROKE} className="text-accent" />
    </svg>
  );
}

/** An open tray, empty — the review queue with nothing due. */
function Tray(props) {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" {...props}>
      <path d="M12 34 22 14h28l10 20" {...STROKE} />
      <path d="M12 34v20a4 4 0 0 0 4 4h32a4 4 0 0 0 4-4V34" {...STROKE} />
      <path d="M12 34h14l3 6h10l3-6h14" {...STROKE} />
      <circle cx="36" cy="52" r="3" fill="currentColor" className="text-accent" />
    </svg>
  );
}

export const ILLUSTRATIONS = {
  shelf: Shelf,
  search: Search,
  tasks: Checklist,
  queue: Tray,
};
