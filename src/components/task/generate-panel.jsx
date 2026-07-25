'use client';

import { useActionState, useEffect, useId, useState } from 'react';

import { buttonClass, quietButtonClass } from '@/components/artefact/control';

/* Generate from material.

   Two things are said before the click, and both exist because nothing is
   generated on upload any more — spending is now a decision, and a decision
   needs its price and its consequences in front of it:

   1. **What it costs.** One model call per section, counted and shown.
   2. **What is already there.** Manual and agent creation reach the same
      sections, so the sections that already carry this type are named before
      the money is spent, not after two cards say the same thing. */
export default function GeneratePanel({
  type,
  courseId,
  sources = [],
  action,
  onDuplicates,
  onDone,
}) {
  const id = useId();
  const [chosen, setChosen] = useState(() => new Set());
  const [covered, setCovered] = useState([]);
  const [state, submit, pending] = useActionState(action, {});

  const sectionIds = [...chosen];

  /* The panel stays open on success on purpose: what it reports — how many
     were written, and which sections it could not write from — is the only
     record of the run, and closing over it would throw that away.

     Asked whenever the choice changes, so the warning is never about a
     selection the learner has already moved on from. */
  useEffect(() => {
    let live = true;

    // Nothing to ask about. What was already known stays known — a section
    // that carries this type still carries it after it is deselected, and
    // `duplicates` below only counts the ones actually chosen.
    if (sectionIds.length === 0 || !onDuplicates) return undefined;

    Promise.resolve(onDuplicates({ format: type.format, sectionIds }))
      .then((ids) => {
        if (live) setCovered(ids ?? []);
      })
      .catch(() => {
        if (live) setCovered([]);
      });

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, type.format, onDuplicates]);

  function toggle(sectionId) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  const duplicates = sectionIds.filter((sectionId) => covered.includes(sectionId));

  return (
    <form action={submit} className="flex flex-col gap-6">
      <input type="hidden" name="format" value={type.format} />
      <input type="hidden" name="subjectId" value={courseId ?? ''} />
      <input type="hidden" name="sectionIds" value={sectionIds.join(',')} />

      {sources.length === 0 ? (
        <p className="max-w-measure text-body">
          There is no material in this course yet. Add a source on the course
          page and its sections will appear here.
        </p>
      ) : (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 font-mono text-label uppercase text-ink-muted">
            The sections to write from
          </legend>

          {sources.map((source) => (
            <div key={source.id} className="flex flex-col gap-1">
              <p className="font-mono text-caption text-ink-muted">{source.title}</p>
              <ul className="flex flex-col border-t border-rule">
                {(source.sections ?? []).map((section) => (
                  <li key={section.id} className="border-b border-rule">
                    <label
                      htmlFor={`${id}-${section.id}`}
                      className="flex min-h-11 items-center gap-3 py-2 text-body-s"
                    >
                      <input
                        id={`${id}-${section.id}`}
                        type="checkbox"
                        checked={chosen.has(section.id)}
                        onChange={() => toggle(section.id)}
                        className="size-4 shrink-0 appearance-none rounded-control border border-ink bg-paper checked:bg-ink"
                      />
                      <span className="flex-1">
                        Section {section.ordinal}
                        {covered.includes(section.id) ? (
                          <span className="ml-2 font-mono text-caption uppercase text-ink-muted">
                            already has this
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </fieldset>
      )}

      {/* The price, before the click. One call per section, and the number is
          the number the learner is about to pay for. */}
      <p className="max-w-measure font-mono text-caption text-ink-muted">
        {sectionIds.length === 0
          ? 'Nothing chosen yet. Each section costs one model call.'
          : `${sectionIds.length} ${sectionIds.length === 1 ? 'section' : 'sections'} chosen — ${sectionIds.length} ${sectionIds.length === 1 ? 'model call' : 'model calls'}.`}
      </p>

      {duplicates.length > 0 ? (
        <p role="status" className="max-w-measure border-l-2 border-ink pl-4 text-body-s text-ink">
          {duplicates.length === 1
            ? 'One of the sections you chose already has this type.'
            : `${duplicates.length} of the sections you chose already have this type.`}{' '}
          Generating again writes a second one.
        </p>
      ) : null}

      {state?.message ? (
        <p
          role={state?.done ? 'status' : 'alert'}
          className={[
            'max-w-measure text-body-s text-ink',
            state?.done ? '' : 'border-l-2 border-ink pl-4',
          ].join(' ')}
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || sectionIds.length === 0}
          className={buttonClass}
        >
          {pending ? 'Writing' : `Generate ${type.label.toLowerCase()}`}
        </button>
        {onDone ? (
          <button type="button" onClick={onDone} className={quietButtonClass}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
