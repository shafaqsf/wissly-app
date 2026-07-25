import { masteryState } from '@/lib/mastery';

/* What the material covers, one idea per row, with mastery as grain.
 *
 * The mark and the word travel together and both come out of `masteryState`.
 * A component that chose its own grain next to a `.field-*` class it also
 * chose is the one way left to make the signature lie — see docs/DESIGN.md,
 * "Never both by hand". */

export default function ConceptShelf({ concepts = [] }) {
  return (
    <ul className="motion-stagger flex flex-col border-t border-rule">
      {concepts.map((concept) => {
        const state = masteryState(concept.mastery);

        return (
          <li
            key={concept.id}
            className="flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-rule py-3"
          >
            <span className="text-body">{concept.name}</span>
            <span className="flex items-center gap-2 font-mono text-caption uppercase text-ink-muted">
              <span
                aria-hidden="true"
                className={`grain grain-mark ${state.field}`}
                style={{ '--grain': state.grain }}
              />
              {state.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
