import Link from 'next/link';

/* Ranked, and in real numbers.
 *
 * gap-report.jsx names only what has been answered and answered wrongly —
 * "a gap is a name, not a score", deliberately, and that panel stays exactly
 * as it was. This is the wider question: where should a learner look next,
 * across every concept short of mastered, including one nobody has touched
 * yet. That ranking is only legible as a number — "worst first" needs a
 * worst to compare against — so this is one of the surfaces the maintainer
 * has scoped the no-percentage rule around for this branch. No field mark
 * here either: a mark is three states, and a ranked list needs more than
 * three positions to be worth ranking. */
export default function WeakestTopics({ concepts = [] }) {
  if (concepts.length === 0) {
    return (
      <p className="max-w-measure text-body-s text-ink-muted">
        Nothing below mastered right now — either there is no material yet,
        or everything here has settled.
      </p>
    );
  }

  return (
    <ol aria-label="Weakest topics" className="motion-stagger flex flex-col">
      {concepts.map((concept, index) => (
        <li key={concept.id} className="border-b border-rule last:border-b-0">
          <Link
            href={`/analytics?course=${concept.subjectId}&concept=${concept.id}`}
            className="motion-lift flex min-h-11 items-center justify-between gap-4 rounded-control py-3"
          >
            <span className="flex items-baseline gap-3">
              <span aria-hidden="true" className="font-mono text-caption text-ink-muted">
                {index + 1}
              </span>
              <span className="text-body">{concept.name}</span>
            </span>
            <span className="font-mono text-caption text-ink-muted">
              {Math.round(concept.mastery * 100)}%
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
