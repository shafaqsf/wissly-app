'use client';

import { useState } from 'react';

import { buttonClass, quietButtonClass } from '@/components/artefact/control';

/* What a selection can have done to it.

   It appears only when something is selected, and it says how many — including
   the ones the current filter is hiding, because acting on a row you cannot
   see is exactly the surprise a bulk action must not spring.

   Nothing here deletes. Archive is `archived_at`, so two hundred cards
   archived by accident are one restore away. */
export default function BulkBar({
  selection,
  hidden = 0,
  courseId,
  courses = [],
  archived = false,
  onArchive,
  onRestore,
  onMove,
  onReschedule,
}) {
  const [open, setOpen] = useState(null);

  if (selection.count === 0) return null;

  const ids = selection.list.join(',');

  return (
    <section
      aria-label="What to do with the selection"
      className="flex flex-col gap-4 rounded-surface border border-rule p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-mono text-label uppercase text-ink">
          {selection.count} selected
          {hidden > 0 ? (
            <span className="ml-2 normal-case text-ink-muted">
              ({hidden} not shown under this filter)
            </span>
          ) : null}
        </p>
        <button type="button" onClick={selection.clear} className={quietButtonClass}>
          Clear the selection
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <form action={archived ? onRestore : onArchive}>
          <input type="hidden" name="ids" value={ids} />
          <input type="hidden" name="subjectId" value={courseId ?? ''} />
          <button type="submit" className={buttonClass}>
            {archived ? 'Restore' : 'Archive'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setOpen(open === 'move' ? null : 'move')}
          className={quietButtonClass}
        >
          Move to another course
        </button>

        <button
          type="button"
          onClick={() => setOpen(open === 'when' ? null : 'when')}
          className={quietButtonClass}
        >
          Reschedule
        </button>
      </div>

      {open === 'move' ? (
        <form action={onMove} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="ids" value={ids} />
          <div className="flex flex-col gap-2">
            <label htmlFor="bulk-course" className="font-mono text-label uppercase text-ink-muted">
              The course to move them to
            </label>
            <select
              id="bulk-course"
              name="subjectId"
              defaultValue={courseId ?? ''}
              className="min-h-11 rounded-control border border-rule bg-paper px-3 text-body text-ink"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonClass}>
            Move them
          </button>
        </form>
      ) : null}

      {open === 'when' ? (
        <form action={onReschedule} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="ids" value={ids} />
          <input type="hidden" name="courseId" value={courseId ?? ''} />
          <div className="flex flex-col gap-2">
            <label htmlFor="bulk-due" className="font-mono text-label uppercase text-ink-muted">
              The day they come back
            </label>
            <input
              id="bulk-due"
              type="date"
              name="dueAt"
              className="min-h-11 rounded-control border border-rule bg-paper px-3 text-body text-ink"
            />
          </div>
          <button type="submit" className={buttonClass}>
            Reschedule them
          </button>
        </form>
      ) : null}
    </section>
  );
}
