import Link from 'next/link';

/* What demonstrably does not hold yet.

   The progress page never had this. It showed a column of marks, which says
   how much is unresolved and never says what. A gap is a named idea that has
   been answered and answered wrongly, and it is only useful next to the
   passage it came from — otherwise the learner is told they have a problem
   and left to go and find it.

   No mark here, and no score. The dashboard and the mastery column already
   spend the viewport's one grain field; a second column of marks beside these
   names would say the same thing twice and take the page over. A gap is a
   name and a destination. */
export default function GapReport({ gaps = [] }) {
  if (gaps.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="max-w-measure text-body-s text-ink-muted">
          Nothing has come apart yet. Answer a round of tasks and whatever does
          not hold will name itself here.
        </p>
        <Link
          href="/tasks/due"
          className="motion-lift inline-flex min-h-11 items-center rounded-control border border-rule px-4 font-mono text-label uppercase"
        >
          Start a round
        </Link>
      </div>
    );
  }

  return (
    <ul aria-label="Gaps" className="motion-stagger flex flex-col">
      {gaps.map((gap) => (
        <li key={gap.id} className="border-b border-rule last:border-b-0">
          {gap.source ? (
            <Link
              href={`/courses/${gap.subjectId}?source=${gap.source.id}`}
              className="motion-lift flex min-h-11 flex-col justify-center gap-1 rounded-control py-3"
            >
              <span className="text-body">{gap.name}</span>
              <span className="font-mono text-caption text-ink-muted">
                {gap.source.title}
                {gap.sectionOrdinal == null ? '' : ` · section ${gap.sectionOrdinal}`}
              </span>
            </Link>
          ) : (
            <div className="flex min-h-11 flex-col justify-center gap-1 py-3">
              <span className="text-body">{gap.name}</span>
              {/* Not an error and not styled as one. The material was
                  archived; the evidence about it stands. */}
              <span className="font-mono text-caption text-ink-muted">
                Source no longer on the shelf
              </span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
