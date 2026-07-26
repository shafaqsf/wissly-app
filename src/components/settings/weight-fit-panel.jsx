'use client';

import { useActionState } from 'react';

import { buttonClass } from '@/components/artefact/control';
import { recomputeWeightsAction } from '@/lib/actions/fsrs-weights.js';

/* Review scheduling used to run on the published FSRS-4.5 defaults for
   everyone — fitted over someone else's review corpus, not this learner's.
   This is the one place in the product a raw number belongs: the maintainer
   has scoped the no-percentage rule out for this and the other analytics
   surfaces, because "log-loss went from 0.41 to 0.29" is the only honest way
   to say a schedule fit *this* learner's own recall better than it did
   before. It is not a grade and it is not mastery, so it earns no field mark. */
export default function WeightFitPanel({ existing, reviewCount, minReviews }) {
  const [state, formAction, pending] = useActionState(recomputeWeightsAction, {});

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col border-t border-rule">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule py-3">
          <dt className="font-mono text-caption uppercase text-ink-muted">
            Your fit
          </dt>
          <dd className="font-mono text-caption text-ink-muted">
            {existing
              ? `Fitted from ${existing.reviewCount} reviews · log-loss ${existing.loss?.toFixed(3) ?? '—'}`
              : `Not fitted yet · ${reviewCount} of ${minReviews} reviews logged`}
          </dd>
        </div>
      </dl>

      <p className="max-w-measure text-body-s text-ink-muted">
        Wissly schedules your reviews on the published FSRS defaults until you
        have enough history of your own. Recomputing searches for the 17
        memory parameters that best predict how you actually recall
        things — a real fit against your review log, not a guess dressed up
        as one.
      </p>

      {state?.message ? (
        <p aria-live="polite" className="max-w-measure text-body-s text-ink">
          {state.message}
        </p>
      ) : null}

      <form action={formAction}>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? 'Fitting…' : 'Recompute my weights'}
        </button>
      </form>
    </div>
  );
}
