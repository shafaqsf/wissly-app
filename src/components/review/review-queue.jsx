'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';

import EmptyState from '@/components/empty/empty-state';
import RatingButtons from './rating-buttons';
import TaskCard from './task-card';
import { useReviewKeys } from './keys';

/* The daily surface: what is due, one task at a time, mixed across the four
   types.

   Position in the queue is a count, not progress — mastery is the only
   progress display in the product and it is carried by grain elsewhere. So
   there is no bar here and no percentage. */
export default function ReviewQueue({ artefacts = [], onRate, onGrade }) {
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(null);
  const [turned, setTurned] = useState(false);

  const artefact = artefacts[index];

  const rate = useCallback(
    (grade) => {
      if (!artefact) return;

      onRate?.({
        artefactId: artefact.id,
        conceptId: artefact.conceptId,
        rating: grade,
        answer: answered,
      });
      setAnswered(null);
      setTurned(false);
      setIndex((current) => current + 1);
    },
    [artefact, answered, onRate],
  );

  /* Turning is the card's own state, held here rather than inside the
     renderer, because the key that turns it is pressed on the page and not on
     the button. Only a flashcard turns: the other three are answered by
     typing or by choosing, and there is nothing to reveal until they are. */
  const turn = useCallback(() => {
    if (!artefact || artefact.format !== 'flashcard' || turned) return;
    setTurned(true);
    setAnswered({ artefactId: artefact.id, correct: null });
  }, [artefact, turned]);

  const rateFromKeyboard = useCallback(
    (grade) => {
      if (!answered) return;
      rate(grade);
    },
    [answered, rate],
  );

  useReviewKeys({ onTurn: turn, onRate: rateFromKeyboard, enabled: Boolean(artefact) });

  if (artefacts.length === 0) {
    return (
      <div className="rounded-surface border border-rule px-6 py-12">
        <EmptyState
          variant="queue"
          action={
            <Link
              href="/tasks/flashcards"
              className="inline-flex min-h-11 items-center rounded-control border border-ink px-4 font-mono text-label uppercase text-ink"
            >
              Write your first card
            </Link>
          }
        >
          Nothing is due right now. Write a card yourself, or generate some
          from your material.
        </EmptyState>
      </div>
    );
  }

  if (!artefact) {
    return (
      <div
        // The one place the product says well done. A card and a sentence: an
        // arrival is quiet, and a tint under it would only make it grey.
        className="flex flex-col items-center justify-center gap-3 rounded-surface border border-rule px-6 py-12 text-center"
      >
        <p className="max-w-measure text-body">
          That is today done. You reviewed {artefacts.length}{' '}
          {artefacts.length === 1 ? 'task' : 'tasks'}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="font-mono text-label uppercase text-ink-muted">
          {index + 1} of {artefacts.length} due
        </p>
        {/* The shortcuts are written down, because a key that is never named is
            a feature only its author has. */}
        <p className="font-mono text-caption text-ink-muted">
          Space turns the card, 1 to 4 rate it, Enter advances
        </p>
      </div>

      <TaskCard
        // A fresh instance per task: a revealed card must not hand its
        // revealed state to the next one.
        key={artefact.id}
        artefact={artefact}
        turned={artefact.format === 'flashcard' ? turned : undefined}
        onTurn={turn}
        // The renderer knows the answer but not which task it belongs to.
        // Naming it here is what lets marking be a server action.
        onGrade={(answer) => onGrade?.({ artefactId: artefact.id, answer })}
        onAnswered={setAnswered}
      />

      {answered ? <RatingButtons onRate={rate} /> : null}
    </div>
  );
}
