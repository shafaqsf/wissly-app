import Link from 'next/link';

import EmptyState from '@/components/empty/empty-state';

/* The results of one search.

   Two things are load-bearing here and both are rules from elsewhere.

   The word "artefact" is what the database calls the row and it must never
   reach the interface, so a hit of that kind is titled by its type —
   Flashcard, Cloze, Summary — and the collective nouns are Tasks and Reading.

   A hit leads to where the thing lives, not to a detail page of its own.
   Search is a way through the product, not a place in it. */

/** What the six formats are called in front of a learner. */
const FORMAT_LABELS = {
  summary: 'Summary',
  glossary: 'Glossary',
  flashcard: 'Flashcard',
  cloze: 'Cloze',
  multiple_choice: 'Multiple choice',
  open_question: 'Open question',
};

/** Which task surface a format is answered on. */
const TASK_ROUTES = {
  flashcard: 'flashcards',
  cloze: 'cloze',
  multiple_choice: 'multiple-choice',
  open_question: 'open-questions',
};

const KIND_LABELS = {
  source: 'Source',
  section: 'Section',
  concept: 'Concept',
  conversation: 'Conversation',
};

export function labelFor(hit) {
  if (hit.kind === 'artefact') {
    return FORMAT_LABELS[hit.title] ?? 'Task';
  }

  return KIND_LABELS[hit.kind] ?? 'Result';
}

export function destinationFor(hit) {
  switch (hit.kind) {
    case 'source':
      return `/courses/${hit.subjectId}?source=${hit.id}`;
    case 'section':
      return `/courses/${hit.subjectId}?source=${hit.parentId}&section=${hit.id}`;
    case 'concept':
      return `/analytics?concept=${hit.id}`;
    case 'conversation':
      return `/dashboard?conversation=${hit.id}`;
    case 'artefact': {
      const route = TASK_ROUTES[hit.title];
      // Reading is read, never answered, so it lives beside its material on
      // the course page rather than on a task surface.
      return route ? `/tasks/${route}?task=${hit.id}` : `/courses/${hit.subjectId}?reading=${hit.id}`;
    }
    default:
      return '/dashboard';
  }
}

/** What the hit is called on the page — the type for a task, the title else. */
function titleFor(hit) {
  return hit.kind === 'artefact' ? labelFor(hit) : hit.title;
}

export default function SearchResults({ query = '', results = [] }) {
  if (query.trim() === '') {
    return (
      <p className="max-w-measure text-body text-ink-muted">
        Search your sources, tasks, reading and conversations. Type anything you
        remember of it — a phrase in quotes matches exactly.
      </p>
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState
        variant="search"
        action={
          <Link
            href="/courses"
            className="motion-lift inline-flex min-h-11 items-center rounded-control border border-rule px-4 font-mono text-label uppercase"
          >
            Go to your courses
          </Link>
        }
      >
        Nothing matches “{query}”. Try fewer words, or add material to a course
        and search again.
      </EmptyState>
    );
  }

  return (
    <ul aria-label="Results" className="motion-stagger flex flex-col">
      {results.map((hit) => (
        <li key={`${hit.kind}-${hit.id}`} className="border-b border-rule">
          <Link
            href={destinationFor(hit)}
            className="motion-lift flex min-h-11 flex-col justify-center gap-1 rounded-control py-4"
          >
            <span className="flex flex-wrap items-baseline gap-3">
              <span className="text-body">{titleFor(hit)}</span>
              <span className="font-mono text-caption uppercase text-ink-muted">
                {labelFor(hit)}
              </span>
            </span>
            {hit.snippet ? (
              <span className="max-w-measure truncate text-body-s text-ink-muted">
                {hit.snippet}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
