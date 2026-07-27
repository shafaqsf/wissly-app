import Link from 'next/link';

import { masteryState } from '@/lib/mastery';

/* What the material covers, one idea per row, with mastery as grain.
 *
 * The mark and the word travel together and both come out of `masteryState`.
 * A component that chose its own grain next to a `.field-*` class it also
 * chose is the one way left to make the signature lie: never both by hand.
 *
 * A row that has been linked to a concept elsewhere carries its "see also"
 * list beneath it — the reason an agent judged the two related, in words,
 * beside a link to where the other one lives. Nothing is invented when there
 * is nothing to say: a concept with no links yet renders exactly as it did
 * before this existed. */

export default function ConceptShelf({ concepts = [], seeAlso = new Map() }) {
  return (
    <ul className="motion-stagger flex flex-col border-t border-rule">
      {concepts.map((concept) => {
        const state = masteryState(concept.mastery);
        const related = seeAlso.get?.(concept.id) ?? [];

        return (
          <li
            key={concept.id}
            id={`concept-${concept.id}`}
            className="flex flex-col gap-2 border-b border-rule py-3"
          >
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-1">
              <span className="text-body">{concept.name}</span>
              <span className="flex items-center gap-2 font-mono text-caption uppercase text-ink-muted">
                <span
                  aria-hidden="true"
                  className={`grain grain-mark ${state.field}`}
                  style={{ '--grain': state.grain }}
                />
                {state.label}
              </span>
            </div>

            {related.length > 0 ? (
              <div className="flex flex-col gap-1 pl-4">
                <p className="font-mono text-caption uppercase text-ink-muted">See also</p>
                <ul className="flex flex-col gap-1">
                  {related.map((link) => (
                    <li key={link.id} className="text-body-s text-ink-muted">
                      <Link
                        href={`/courses/${link.subjectId}#concept-${link.conceptId}`}
                        className="text-ink underline-offset-2 hover:underline"
                      >
                        {link.term}
                      </Link>
                      {` — ${link.reason}`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
