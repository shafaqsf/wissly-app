'use client';

import { useActionState, useEffect, useId, useState } from 'react';

import { buttonClass, quietButtonClass } from '@/components/artefact/control';
import ClozeEditor from './cloze-editor';

/* One form, four shapes. Writing one and editing one are the same fields
   against two different actions, so they are one component: a card the learner
   typed and a card the learner corrected are the same object.

   No model is reached from here. That is the point of "Write one" — it costs
   nothing, and a learner who knows exactly what they want to be asked should
   not have to spend a call to get it. */

const OPTIONS = 4;

export default function TaskForm({
  type,
  action,
  task,
  courseId,
  sources = [],
  onDone,
  submitLabel = 'Save',
}) {
  const id = useId();
  const [state, submit, pending] = useActionState(action, {});
  const payload = task?.payload ?? {};
  const [rightAnswer, setRightAnswer] = useState(payload.answer_index ?? 0);

  const sections = sources.flatMap((source) =>
    (source.sections ?? []).map((section) => ({ ...section, source: source.title })),
  );

  // The caller closes the form; it is not this component's business whether a
  // saved card leaves the editor open. After the render, never during it.
  useEffect(() => {
    if (state?.done) onDone?.();
  }, [state, onDone]);

  return (
    <form action={submit} className="flex flex-col gap-6">
      <input type="hidden" name="format" value={type.format} />
      <input type="hidden" name="subjectId" value={courseId ?? ''} />
      {task ? <input type="hidden" name="id" value={task.id} /> : null}

      {type.format === 'flashcard' ? (
        <>
          <Field id={`${id}-front`} name="front" label="The front" defaultValue={payload.front} />
          <Field id={`${id}-back`} name="back" label="The back" defaultValue={payload.back} />
        </>
      ) : null}

      {type.format === 'cloze' ? (
        <ClozeEditor text={payload.text} answer={payload.answer} />
      ) : null}

      {type.format === 'multiple_choice' ? (
        <>
          <Field id={`${id}-stem`} name="stem" label="The question" defaultValue={payload.stem} />

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 font-mono text-label uppercase text-ink-muted">
              One right answer and three that are not
            </legend>

            {Array.from({ length: OPTIONS }, (unused, index) => (
              <div key={index} className="flex flex-col gap-2 border-t border-rule pt-4">
                <label className="flex min-h-11 items-center gap-3 text-body">
                  <input
                    type="radio"
                    name="answer_index"
                    value={index}
                    checked={Number(rightAnswer) === index}
                    onChange={() => setRightAnswer(index)}
                    // Drawn by hand: Chrome drops an author radius at
                    // `appearance: auto`, and the focus ring came out square.
                    className="size-4 shrink-0 appearance-none rounded-round border border-ink bg-paper checked:bg-ink"
                  />
                  <span className="font-mono text-caption uppercase text-ink-muted">
                    This one is right
                  </span>
                </label>

                <Field
                  id={`${id}-option-${index}`}
                  name={`option-${index}`}
                  label={`Answer ${index + 1}`}
                  defaultValue={payload.options?.[index]}
                />
                <Field
                  id={`${id}-rationale-${index}`}
                  name={`rationale-${index}`}
                  label={`Why answer ${index + 1} stands or falls`}
                  defaultValue={payload.rationales?.[index]}
                />
              </div>
            ))}
          </fieldset>
        </>
      ) : null}

      {type.format === 'open_question' ? (
        <>
          <Field id={`${id}-prompt`} name="prompt" label="The question" defaultValue={payload.prompt} />
          <Field
            id={`${id}-model`}
            name="model_answer"
            label="An answer that would score full marks"
            defaultValue={payload.model_answer}
            rows={5}
          />
          <Field
            id={`${id}-criteria`}
            name="criteria"
            label="What a correct answer has to say, one per line"
            defaultValue={(payload.criteria ?? []).join('\n')}
            rows={4}
          />
        </>
      ) : null}

      {sections.length > 0 ? (
        <div className="flex max-w-measure flex-col gap-2">
          <label htmlFor={`${id}-section`} className="font-mono text-label uppercase text-ink-muted">
            Where in your material this comes from
          </label>
          <select
            id={`${id}-section`}
            name="sectionId"
            defaultValue={task?.section_id ?? ''}
            className="min-h-11 rounded-control border border-rule bg-paper px-3 text-body text-ink"
          >
            <option value="">Nowhere in particular</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.source} — section {section.ordinal}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {state?.message && !state?.done ? (
        <p role="alert" className="max-w-measure border-l-2 border-ink pl-4 text-body-s text-ink">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? 'Saving' : submitLabel}
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

function Field({ id, name, label, defaultValue = '', rows = 3 }) {
  return (
    <div className="flex max-w-measure flex-col gap-2">
      <label htmlFor={id} className="font-mono text-label uppercase text-ink-muted">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="rounded-control border border-rule bg-paper p-3 text-body text-ink"
      />
    </div>
  );
}
