/* Mastery is a value in [0,1] per concept, merged from every piece of
   evidence a learner has produced. It is rendered as a field — grain density
   and depth of ink, moving together — plus, since v0.15, a colour layer
   beside the mark: no bar, no percentage, no second *numeric* display, but a
   mark is now allowed a second way to be read at a glance — the mastery
   gradient.

   Three states, because grain has three meaningful intensities. The 0.9
   threshold is where the scheduler stops asking often enough for the concept
   to feel like work.

   This is the only place the three are paired. A component reads `grain`,
   `field` and `color` from here rather than deciding any of them for itself,
   so the interface cannot end up saying one thing with its texture and
   another with its colour. */

export const MASTERED_AT = 0.9;

const STATES = {
  untouched: {
    id: 'untouched',
    label: 'Untouched',
    grain: 'var(--grain-3)',
    field: 'field-unresolved',
    color: 'var(--color-mastery-low)',
  },
  'in-progress': {
    id: 'in-progress',
    label: 'In progress',
    grain: 'var(--grain-2)',
    field: 'field-partial',
    color: 'var(--color-mastery-mid)',
  },
  mastered: {
    id: 'mastered',
    label: 'Mastered',
    grain: 'var(--grain-0)',
    field: 'field-settled',
    color: 'var(--color-mastery-high)',
  },
};

export function masteryState(mastery) {
  const value = Number(mastery);

  if (!Number.isFinite(value) || value <= 0) return STATES.untouched;
  if (value >= MASTERED_AT) return STATES.mastered;
  return STATES['in-progress'];
}

export function averageMastery(concepts = []) {
  if (concepts.length === 0) return 0;

  const total = concepts.reduce(
    (sum, concept) => sum + (Number(concept.mastery) || 0),
    0,
  );

  return total / concepts.length;
}
