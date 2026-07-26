'use client';

import { useActionState } from 'react';

import { buttonClass, inputClass, quietButtonClass } from '@/components/artefact/control';

/* Read-only, by name as much as by policy: there is no level to pick here
   because subject_shares only ever means `view` (migrations/015). Widening
   that later is an additive schema change; a select box here that promised
   more than the database grants would not be. */

export default function SharePanel({ courseId, shares = [], shareAction, revokeAction, initialState = {} }) {
  const [state, formAction, pending] = useActionState(shareAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex max-w-measure flex-col gap-4">
        {state?.message ? (
          <p role="alert" className="border-l-2 border-ink pl-4 text-body-s text-ink">
            {state.message}
          </p>
        ) : null}

        <input type="hidden" name="courseId" value={courseId} />

        <div className="flex flex-col gap-2">
          <label htmlFor="share-email" className="font-mono text-label uppercase text-ink">
            Share with (email)
          </label>
          <input
            id="share-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            className={`${inputClass} w-full`}
          />
        </div>

        <div>
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? 'Sharing…' : 'Share course'}
          </button>
        </div>
      </form>

      {shares.length === 0 ? (
        <p className="text-body-s text-ink-muted">Not shared with anyone yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shares.map((share) => (
            <li
              key={share.id}
              className="flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-control border border-rule px-4 py-3"
            >
              <span className="text-body-s">{share.invitee_email}</span>
              <form action={revokeAction}>
                <input type="hidden" name="id" value={share.id} />
                <input type="hidden" name="courseId" value={courseId} />
                <button
                  type="submit"
                  className={quietButtonClass}
                  aria-label={`Stop sharing with ${share.invitee_email}`}
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
