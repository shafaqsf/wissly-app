'use client';

import { buttonClass } from './control';
import { FORMAT_NAMES } from '@/components/task/task-types';

/* Composed, not generated — see the note on the practice_exam schema in
   src/lib/agent/formats.js. Each item names an existing task rather than
   holding one, so this renders an index of what the exam draws from and a
   single completion event, rather than duplicating every format's own
   renderer inline; each referenced task keeps answering, grading and citing
   for itself wherever it already appears in Tasks.

   There is no section for a practice exam to cite: it references tasks, not
   a passage, so the "From …" citation every other renderer carries is
   absent here on purpose. */
export default function PracticeExamArtefact({ artefact, onAnswered }) {
  const { title, instructions, time_limit_minutes: timeLimit, items } = artefact.payload;

  function complete() {
    onAnswered?.({ artefactId: artefact.id, correct: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-title font-semibold">{title}</h2>
        <p className="max-w-measure text-body-s">{instructions}</p>
        <p className="font-mono text-caption uppercase text-ink-muted">
          {timeLimit} minutes · {items.length} {items.length === 1 ? 'question' : 'questions'}
        </p>
      </div>

      <ol className="flex max-w-measure flex-col gap-1">
        {items.map((item, index) => (
          <li key={item.artefact_id} className="flex min-h-11 items-center gap-3 border-b border-rule py-2 text-body-s">
            <span className="font-mono text-caption text-ink-muted">{index + 1}</span>
            <span>{FORMAT_NAMES[item.format] ?? item.format}</span>
          </li>
        ))}
      </ol>

      <p className="max-w-measure text-body-s text-ink-muted">
        This exam draws from tasks you have already answered elsewhere in Tasks —
        each one keeps its own schedule; completing this exam schedules the exam
        itself, separately.
      </p>

      <div>
        <button type="button" onClick={complete} className={buttonClass}>
          Mark this exam complete
        </button>
      </div>
    </div>
  );
}
