'use client';

import { useMemo, useState } from 'react';

import { buttonClass, quietButtonClass } from '@/components/artefact/control';
import EmptyState from '@/components/empty/empty-state';
import BulkBar from './bulk-bar';
import ExportButtons from './export-buttons';
import FlashcardStack from './flashcard-stack';
import GeneratePanel from './generate-panel';
import TaskForm from './task-form';
import TaskList from './task-list';
import { ROWS } from './surfaces';
import { useSelection } from './selection';

/* One type's working surface.

   The filter narrows what is shown. The selection is held here, above it, so
   changing the filter re-draws the list and leaves the selection exactly as it
   was — see `selection.js`. What that costs is one sentence in the bulk bar,
   naming how many selected rows the filter is currently hiding, because a bulk
   action must never reach further than the learner can see without saying so.

   Two ways in, side by side and equal: writing one costs nothing and reaches
   no model; generating spends one call per section and says so first. */
export default function TaskWorkbench({
  type,
  courseId = '',
  courseName = '',
  courses = [],
  tasks = [],
  sources = [],
  archived = false,
  actions,
}) {
  const [sourceId, setSourceId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [open, setOpen] = useState(null);
  const selection = useSelection();

  const sectionsOfSource = useMemo(() => {
    const source = sources.find((one) => one.id === sourceId);
    return source ? (source.sections ?? []) : [];
  }, [sources, sourceId]);

  const shown = useMemo(() => {
    const inSource = new Set(sectionsOfSource.map((section) => section.id));

    return tasks.filter((task) => {
      if (sectionId) return task.section_id === sectionId;
      if (sourceId) return inSource.has(task.section_id);
      return true;
    });
  }, [tasks, sourceId, sectionId, sectionsOfSource]);

  const row = ROWS[type.format];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Filter
            id="filter-source"
            label="Source"
            value={sourceId}
            onChange={(value) => {
              setSourceId(value);
              setSectionId('');
            }}
            options={sources.map((source) => ({ value: source.id, label: source.title }))}
            all="Every source"
          />
          <Filter
            id="filter-section"
            label="Section"
            value={sectionId}
            onChange={setSectionId}
            options={sectionsOfSource.map((section) => ({
              value: section.id,
              label: `Section ${section.ordinal}`,
            }))}
            all="Every section"
            disabled={!sourceId}
          />
        </div>

        {!archived ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpen(open === 'write' ? null : 'write')}
              className={buttonClass}
            >
              Write one
            </button>
            <button
              type="button"
              onClick={() => setOpen(open === 'generate' ? null : 'generate')}
              className={quietButtonClass}
            >
              Generate from material
            </button>
            {type.format === 'flashcard' ? (
              <ExportButtons tasks={shown} course={courseName} />
            ) : null}
          </div>
        ) : null}
      </div>

      {open === 'write' ? (
        <section aria-label="Write one" className="rounded-surface border border-rule p-5">
          <TaskForm
            type={type}
            action={actions.create}
            courseId={courseId}
            sources={sources}
            onDone={() => setOpen(null)}
            submitLabel="Save it"
          />
        </section>
      ) : null}

      {open === 'generate' ? (
        <section
          aria-label="Generate from material"
          className="rounded-surface border border-rule p-5"
        >
          <GeneratePanel
            type={type}
            courseId={courseId}
            sources={sources}
            action={actions.generate}
            onDuplicates={actions.duplicates}
            onDone={() => setOpen(null)}
          />
        </section>
      ) : null}

      <BulkBar
        selection={selection}
        hidden={selection.hiddenFrom(shown)}
        courseId={courseId}
        courses={courses}
        archived={archived}
        onArchive={actions.archive}
        onRestore={actions.restore}
        onMove={actions.move}
        onReschedule={actions.reschedule}
      />

      {/* The stack is practice without a schedule — the pile on the desk,
          turned through. Rating happens in Due, against the FSRS state. */}
      {type.format === 'flashcard' && !archived ? <FlashcardStack tasks={shown} /> : null}

      {shown.length === 0 ? (
        <Empty type={type} archived={archived} filtered={Boolean(sourceId || sectionId)} />
      ) : (
        <TaskList
          type={type}
          tasks={shown}
          selection={selection}
          courseId={courseId}
          sources={sources}
          onUpdate={actions.update}
        >
          {row}
        </TaskList>
      )}
    </div>
  );
}

/* Nothing is generated on upload any more, so an empty surface is the normal
   first thing a learner sees. It says what the next step is and offers it. */
function Empty({ type, archived, filtered }) {
  if (archived) {
    return (
      <p className="max-w-measure text-body">
        Nothing archived here. Archived {type.label.toLowerCase()} keep their
        place in your material and can be restored at any time.
      </p>
    );
  }

  if (filtered) {
    return (
      <p className="max-w-measure text-body">
        {`No ${type.label.toLowerCase()} under this filter. Widen it, or write one against this part of your material.`}
      </p>
    );
  }

  // The first thing a new course meets, since nothing is generated on
  // upload — task item 7 in v0.15 gives it an illustration, not only a
  // sentence.
  return (
    <EmptyState variant="tasks">
      {`No ${type.label.toLowerCase()} yet. Write one yourself — it costs nothing — or generate a set from your material.`}
    </EmptyState>
  );
}

function Filter({ id, label, value, onChange, options, all, disabled = false }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-mono text-label uppercase text-ink-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-control border border-rule bg-paper px-3 text-body text-ink disabled:opacity-40"
      >
        <option value="">{all}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
