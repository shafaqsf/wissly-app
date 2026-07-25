import Link from 'next/link';

import { TASK_TYPES } from './task-types';

/* The types, down the left, with how many of each there are.

   The count is the reason this is a list and not a set of tabs: "Cloze 8" is
   the answer to a question a learner actually asks, and a tab strip has
   nowhere to put it. Due sits at the top because it is the one entry that is
   about today rather than about a type, and Archive at the foot behind a rule
   because it is not a fifth type. */
export default function TypeNav({ active, courseId = '', counts = {} }) {
  const query = courseId ? `?course=${courseId}` : '';

  const entries = [
    { slug: 'due', label: 'Due', href: `/tasks/due${query}` },
    ...TASK_TYPES.map((type) => ({
      slug: type.slug,
      label: type.label,
      href: `/tasks/${type.slug}${query}`,
    })),
  ];

  return (
    <nav aria-label="Task types" className="flex flex-col gap-1">
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <li key={entry.slug}>
            <Entry entry={entry} active={active} count={counts[entry.slug]} />
          </li>
        ))}
      </ul>

      <div className="mt-2 border-t border-rule pt-2">
        <Entry
          entry={{ slug: 'archive', label: 'Archive', href: `/tasks/archive${query}` }}
          active={active}
        />
      </div>
    </nav>
  );
}

function Entry({ entry, active, count }) {
  const current = entry.slug === active;

  return (
    <Link
      href={entry.href}
      aria-current={current ? 'page' : undefined}
      className={[
        'flex min-h-11 items-center justify-between gap-4 rounded-control px-3 text-body',
        // The current type is named in ink and underlined. No fill, no tint —
        // a selected row is not a state the grain encodes.
        current ? 'font-semibold underline underline-offset-4' : 'text-ink-muted',
      ].join(' ')}
    >
      <span>{entry.label}</span>
      {/* The space is load-bearing: without a text node between the two spans
          the accessible name comes out as "Flashcards34". */}
      {count == null ? null : ' '}
      {count == null ? null : (
        <span className="motion-count text-caption text-ink-muted">{count}</span>
      )}
    </Link>
  );
}
