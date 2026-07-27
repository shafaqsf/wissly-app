'use client';

import { useActionState } from 'react';

import { buttonClass, inputClass } from '@/components/artefact/control';

/* Where material comes in: pasted text, a link, or a file — a PDF, a .pptx
   slide deck or a photo of a page.

   The subject picker is gone. This form used to live on `/library`, where it
   had to ask which subject the material belonged to and a typo filed a lecture
   under a course that did not exist yet. It lives on a course page now, so the
   course is the page, and it travels as a hidden field rather than a question.

   Reading is all this does, for text, a link, a PDF and a slide deck — it
   ingests, cuts the source into sections and names a concept per section, with
   no model call at all. A photo is the one exception: there is no text under a
   photo to ingest instead of transcribing, so choosing one always costs a
   model call to read it. Explaining the diagrams on a PDF is the other one,
   and it is a checkbox rather than a default, for the same reason nothing
   else here is a default: the wait, and what it costs, only start when the
   learner asks. */

const label = 'font-mono text-label uppercase text-ink';

export default function AddMaterialForm({ action, courseId, initialState = {} }) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-measure flex-col gap-6">
      <input type="hidden" name="courseId" value={courseId ?? ''} />
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
        <label htmlFor="url" className={label}>
          Or paste a link
        </label>
        <input
          id="url"
          name="url"
          type="url"
          placeholder="https://"
          className={`${inputClass} w-full`}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="file" className={label}>
          Or choose a PDF, a slide deck or a photo
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/*"
          className="min-h-11 rounded-control font-body text-body-s text-ink"
        />
        <p className="font-mono text-caption text-ink-muted">
          Up to 10 MB. A photo is transcribed by the model — the one file
          type here that is not free to add.
        </p>
      </div>

      <div className="flex items-start gap-3">
        <input
          id="explainImages"
          name="explainImages"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded-control border border-rule"
        />
        <label htmlFor="explainImages" className="font-body text-body-s text-ink">
          Also explain the diagrams on image-heavy PDF pages
          <span className="block font-mono text-caption text-ink-muted">
            Uses the model — only for pages a PDF page barely has any text on.
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? 'Reading it…' : 'Add material'}
          </button>
        </div>
        <p className="font-mono text-caption text-ink-muted">
          Nothing is generated from it. wissly reads it, cuts it into sections
          and names what it covers. Reading a PDF, a slide deck, pasted text
          or a link costs nothing; transcribing a photo, or explaining a
          diagram, is the model call this form can make.
        </p>
      </div>

      {pending ? (
        /* A mark, not a surface. A field under the submit button is still a
           field on a surface the learner is reading: beside a
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
          Reading it and naming what it covers
        </p>
      ) : null}
    </form>
  );
}
