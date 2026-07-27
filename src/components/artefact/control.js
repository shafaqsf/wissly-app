/* The shared shape of a control. 44px minimum in both directions, the control
   radius, ink on paper, and nothing that depends on hue. Kept in one place
   because every artefact needs the same button and none of them should invent
   it — three of them used to, in three slightly different ways. */

export const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-ink px-4 font-mono text-label uppercase text-ink transition-opacity duration-[120ms] ease-out hover:opacity-70 disabled:opacity-40';

export const quietButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-rule px-4 font-mono text-label uppercase text-ink-muted transition-opacity duration-[120ms] ease-out hover:text-ink disabled:opacity-40';

/* The one filled control in the product: the primary call to action, such as
   the button that commits an account. It is also the one control that wears
   the accent — v0.15's deliberate loosening
   of "no colour in the chrome". Nothing else earns a solid fill, and nothing
   else should copy this. */
export const filledButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-accent px-6 font-mono text-label uppercase tracking-[0.08em] text-paper transition-opacity duration-[120ms] ease-out hover:opacity-80 disabled:opacity-60';

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
