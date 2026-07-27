'use client';

import { useActionState } from 'react';

import { buttonClass } from '@/components/artefact/control';

/* The one place this course's concepts get compared against the rest of the
   library. A model call, so it is a button the learner presses rather than
   something that runs on upload — the same discipline `AddMaterialForm`
   holds to for sections and concepts themselves. */

export default function FindRelatedConcepts({ action, courseId, initialState = {} }) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="subjectId" value={courseId ?? ''} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? 'Looking…' : 'Find related concepts'}
        </button>
      </div>
      {state?.message ? (
        <p
          role="status"
          className={[
            'font-body text-body-s text-ink',
            state.done ? '' : 'border-l-2 border-ink pl-4',
          ].join(' ')}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
