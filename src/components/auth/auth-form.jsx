'use client';

import { useActionState } from 'react';

import { filledButtonClass, inputClass } from '@/components/artefact/control.js';

/* Copy differs between the two screens; nothing else does, so they share
   one component rather than two near-identical files. */
const COPY = {
  'sign-in': { submit: 'Sign in', pending: 'Signing in…', autoComplete: 'current-password' },
  'sign-up': { submit: 'Create account', pending: 'Creating account…', autoComplete: 'new-password' },
};

const field = `w-full py-2 font-body placeholder:text-ink-muted ${inputClass}`;

const label = 'font-mono text-label uppercase tracking-[0.08em] text-ink';

export default function AuthForm({ mode, action, next = '', initialState = {} }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const copy = COPY[mode];
  const message = state?.message;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {message ? (
        /* No red. A failed surface is the only thing on the page with a
           2px left rule, so it reads instantly without hue. */
        <p role="alert" className="border-l-2 border-ink py-1 pl-4 font-body text-body-s text-ink">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className={label}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={field}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className={label}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={copy.autoComplete}
          className={field}
        />
        {mode === 'sign-up' ? (
          <p className="font-mono text-caption text-ink-muted">At least 8 characters.</p>
        ) : null}
      </div>

      <input type="hidden" name="next" value={next} />

      <button
        type="submit"
        disabled={pending}
        className={filledButtonClass}
      >
        {pending ? copy.pending : copy.submit}
      </button>
    </form>
  );
}
