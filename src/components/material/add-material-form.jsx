'use client';

import { useActionState } from 'react';

import { buttonClass, inputClass } from '@/components/artefact/control';

/* Where material comes in. Paste text or choose a PDF; the subject is what
   files it.

   Generating from a source takes a model call per section, so the pending
   state is not decorative — it is most of the wait. It is the grain field
   DESIGN.md reserves for a working agent, drifting until the work settles. */

const label = 'font-mono text-label uppercase text-ink';

export default function AddMaterialForm({ action, subjects = [], initialState = {} }) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-measure flex-col gap-6">
      {state?.message ? (
        <p
          role="status"
          className={[
            'py-1 font-body text-body-s text-ink',
            // Only a failure gets the 2px rule. A report of what was added is
            // not a failure, so it gets words and nothing else.
            state.done ? '' : 'border-l-2 border-ink pl-4',
          ].join(' ')}
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="subject" className={label}>
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          required
          list={subjects.length > 0 ? 'known-subjects' : undefined}
          className={`${inputClass} w-full`}
        />
        {subjects.length > 0 ? (
          <datalist id="known-subjects">
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.title} />
            ))}
          </datalist>
        ) : null}
        <p className="font-mono text-caption text-ink-muted">
          An existing name files it there. A new one starts a subject.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="title" className={label}>
          What is it called
        </label>
        <input id="title" name="title" className={`${inputClass} w-full`} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="text" className={label}>
          Paste the text
        </label>
        <textarea
          id="text"
          name="text"
          rows={8}
          className="rounded-control border border-rule bg-paper px-3 py-2 font-body text-body text-ink"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="file" className={label}>
          Or choose a PDF
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf"
          className="min-h-11 font-body text-body-s text-ink"
        />
        <p className="font-mono text-caption text-ink-muted">Up to 10 MB.</p>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? 'Reading it…' : 'Add material'}
        </button>
      </div>

      {pending ? (
        /* A mark, not a surface. A field under the submit button is still a
           field on a surface the learner is reading — docs/DESIGN.md: beside a
           form, never behind or below one. The mark drifts while the work is
           unresolved and says the same thing at a fraction of the area. */
        <p
          aria-live="polite"
          className="flex items-center gap-3 font-mono text-label uppercase text-ink"
        >
          <span
            aria-hidden="true"
            className="grain grain-mark grain-working field-unresolved"
            style={{ '--grain': 'var(--grain-3)' }}
          />
          Reading, then writing what to ask you
        </p>
      ) : null}
    </form>
  );
}
