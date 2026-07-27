'use client';

import { useActionState } from 'react';

import { quietButtonClass } from '@/components/artefact/control';

/* One form per row, each with its own action state, so importing one course
   failing (its owner un-published it between page load and click, say) says
   so beside that row rather than swallowing the error or blaming every row
   on the shelf. */
export default function ImportForm({ courseId, action, initialState = {} }) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="courseId" value={courseId} />
      <button type="submit" disabled={pending} className={quietButtonClass}>
        {pending ? 'Importing…' : 'Import'}
      </button>
      {state?.message ? (
        <p role="alert" className="max-w-[24ch] border-l-2 border-ink pl-3 text-caption text-ink">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
