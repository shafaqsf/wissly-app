'use client';

import { useActionState } from 'react';

import { buttonClass, inputClass } from '@/components/artefact/control';

/* A course is a thing the learner starts, not a thing that appears. One field
   and one verb: naming it is the whole act, and everything else about a course
   — its material, its concepts, its reading — is filled in on the shelf the
   creation lands on. */

export default function CreateCourseForm({ action, initialState = {} }) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-measure flex-col gap-4">
      {state?.message ? (
        // No colour carries a failure; a 2px ink rule does, and nothing else
        // in the interface has one. There are no status colours.
        <p role="alert" className="border-l-2 border-ink pl-4 text-body-s text-ink">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="course-title" className="font-mono text-label uppercase text-ink">
          Name the course
        </label>
        <input
          id="course-title"
          name="title"
          required
          autoComplete="off"
          className={`${inputClass} w-full`}
        />
      </div>

      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? 'Creating…' : 'Create course'}
        </button>
      </div>
    </form>
  );
}
