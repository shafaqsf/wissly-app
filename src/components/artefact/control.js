/* The shared shape of a control. 44px minimum in both directions, 4px radius,
   ink on paper, and nothing that depends on hue. Kept in one place because
   every artefact needs the same button and none of them should invent it. */

export const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-ink px-4 font-mono text-label uppercase text-ink transition-opacity duration-[120ms] ease-out hover:opacity-70 disabled:opacity-40';

export const quietButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-rule px-4 font-mono text-label uppercase text-ink-muted transition-opacity duration-[120ms] ease-out hover:text-ink disabled:opacity-40';

export const inputClass =
  'min-h-11 rounded-control border border-rule bg-paper px-3 text-body text-ink';

/* One normalisation for every free-text comparison: case and surrounding
   space are never what a learner got wrong. */
export function normalise(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
