'use client';

import { useState } from 'react';

import { quietButtonClass } from '@/components/artefact/control';
import TaskForm from './task-form';

/* The table every type tidies itself in.

   The chrome is shared — a checkbox, an edit, the origin — and the body is
   not: a flashcard reads as two sides, a cloze as one sentence with a gap.
   So the row's content comes in as a function of the task and this component
   holds nothing but the selection and the editor. */
export default function TaskList({
  type,
  tasks = [],
  selection,
  courseId,
  sources,
  onUpdate,
  children,
}) {
  const [editing, setEditing] = useState(null);
  const shownIds = tasks.map((task) => task.id);
  const allShown = shownIds.length > 0 && shownIds.every((id) => selection.has(id));

  if (tasks.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-11 w-fit items-center gap-3 font-mono text-label uppercase text-ink-muted">
        <input
          type="checkbox"
          checked={allShown}
          onChange={() => selection.toggleAll(shownIds)}
          className="size-4 shrink-0 appearance-none rounded-control border border-ink bg-paper checked:bg-ink"
        />
        Select all shown
      </label>

      {/* Six carry the offset and the rest arrive with the sixth — past six an
          offset reads as the page being slow rather than as a list arriving. */}
      <ul className="motion-stagger flex flex-col border-t border-rule">
        {tasks.map((task) => (
          <li key={task.id} className="flex flex-col gap-3 border-b border-rule py-4">
            <div className="flex items-start gap-3">
              <label className="flex min-h-11 items-center">
                <span className="sr-only">Select this one</span>
                <input
                  type="checkbox"
                  checked={selection.has(task.id)}
                  onChange={() => selection.toggle(task.id)}
                  className="size-4 shrink-0 appearance-none rounded-control border border-ink bg-paper checked:bg-ink"
                />
              </label>

              <div className="flex flex-1 flex-col gap-2">
                {children(task)}
                <p className="font-mono text-caption text-ink-muted">
                  {task.origin === 'agent' ? 'Written by the agent' : 'Written by you'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditing(editing === task.id ? null : task.id)}
                className={quietButtonClass}
              >
                {editing === task.id ? 'Close' : 'Edit'}
              </button>
            </div>

            {editing === task.id ? (
              <TaskForm
                type={type}
                action={onUpdate}
                task={task}
                courseId={courseId}
                sources={sources}
                onDone={() => setEditing(null)}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
