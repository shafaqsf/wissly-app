'use client';

import { useActionState } from 'react';
import { quietButtonClass } from '@/components/artefact/control';
import { sendWeeklyReportAction } from '@/lib/actions/weekly-report.js';

/* Feature 2 of the notification work, reachable end to end: this button
   builds the real weekly report from this learner's own data and hands it
   to `sendWeeklyReport`, which hands it to an `EmailSender`. What it does
   not do is deliver it — `ConsoleEmailSender` writes the email to the server
   log, and the message below says exactly that rather than implying an
   inbox was reached. */
export default function WeeklyReportPreview() {
  const [state, formAction, pending] = useActionState(sendWeeklyReportAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <button type="submit" disabled={pending} className={quietButtonClass}>
          {pending ? 'Building your report…' : 'Preview this week’s email'}
        </button>
      </div>
      {state?.message ? (
        <p className="max-w-measure text-body-s text-ink-muted">{state.message}</p>
      ) : null}
    </form>
  );
}
