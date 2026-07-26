'use client';

import { useActionState } from 'react';

import { buttonClass, inputClass } from '@/components/artefact/control';

/* The pace panel: what "on track" means for this course, today.
 *
 * Two real numbers live here on purpose — a scoped exception to the rest of
 * the product's "no progress bar, no percentage" rule (see README.md). A
 * mastery mark says how resolved a concept is, and that has no natural
 * denominator to be a fraction of, which is why it stays a field. A count of
 * days until an exam and a count of reviews left today both do have one, and
 * hiding a countable fact behind a field mark would be the interface being
 * coy rather than quiet. Nothing about mastery changes here: this panel never
 * renders a percentage of *mastery*, only of calendar and of a review count.
 */

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

function formatDate(value) {
  return DATE_FORMAT.format(new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`));
}

function reviewCount(count) {
  return `${count} review${count === 1 ? '' : 's'}`;
}

export default function ExamPace({ courseId, action, examDate, goal, plan, initialState = { message: null } }) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const paceLine = examDate
    ? goal.remaining > 0
      ? `${goal.remaining} more today to stay on track for the exam on ${formatDate(examDate)}.`
      : `Today's target is done. ${goal.horizonDays} day${goal.horizonDays === 1 ? '' : 's'} left until the exam.`
    : goal.target > 0
      ? `${goal.remaining > 0 ? goal.remaining : 0} more today to keep pace with what is due.`
      : 'Nothing due to plan around yet.';

  return (
    <div className="flex flex-col gap-6">
      {state?.message ? (
        <p role="alert" className="border-l-2 border-l-ink pl-4 text-body-s text-ink">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="max-w-measure text-body-s text-ink">{paceLine}</p>
        <p className="font-mono text-caption uppercase text-ink-muted">
          {goal.target} a day ·{' '}
          {examDate
            ? `${goal.horizonDays} day${goal.horizonDays === 1 ? '' : 's'} to the exam`
            : `spread over the next ${goal.horizonDays} days`}
        </p>
      </div>

      {plan ? (
        <ol className="flex flex-col">
          {plan.days.map((day) => (
            <li
              key={day.date}
              className="flex items-center justify-between gap-4 border-b border-rule py-2 last:border-b-0"
            >
              <span className="font-mono text-caption uppercase text-ink-muted">
                {formatDate(day.date)}
              </span>
              <span className="text-body-s text-ink">{reviewCount(day.count)}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <form action={formAction} className="flex flex-wrap items-end gap-4">
        <input type="hidden" name="courseId" value={courseId} />
        <div className="flex flex-col gap-2">
          <label htmlFor="exam-date" className="font-mono text-label uppercase text-ink">
            Exam date
          </label>
          <input
            id="exam-date"
            name="examDate"
            type="date"
            defaultValue={examDate ?? ''}
            className={inputClass}
          />
        </div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? 'Saving…' : examDate ? 'Update' : 'Set date'}
        </button>
      </form>
    </div>
  );
}
