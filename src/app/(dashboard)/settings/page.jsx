import SignOutButton from '@/components/auth/sign-out-button';
import WeightFitPanel from '@/components/settings/weight-fit-panel';
import { reviewLogFor, weightsFor } from '@/lib/data/fsrs-weights.js';
import { MIN_REVIEWS_TO_FIT } from '@/lib/review/fit-weights.js';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Settings — wissly',
};

/* There used to be one setting worth the name — which account this is — and
   the one action beside it. Now there are two: review scheduling is a real
   preference, because it is the one place in the product a learner can act
   on their own review history rather than just read it. */
export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email ?? null;

  const [existing, reviews] = await Promise.all([
    weightsFor(supabase),
    reviewLogFor(supabase),
  ]);

  return (
    <div className="flex flex-col gap-16">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">
          Your account
        </p>
        <h1 className="font-display text-display-l font-bold">Settings</h1>
      </header>

      <section aria-label="Account" className="flex flex-col gap-6">
        <h2 className="font-display text-heading font-semibold">Account</h2>

        <dl className="flex flex-col border-t border-rule">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule py-3">
            <dt className="font-mono text-caption uppercase text-ink-muted">
              Signed in as
            </dt>
            <dd className="text-body">{email ?? 'No address on this account'}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3">
          <SignOutButton />
          <p className="max-w-measure text-body-s text-ink-muted">
            Your material stays where it is. Signing back in brings it all
            back.
          </p>
        </div>
      </section>

      <section aria-label="Review scheduling" className="flex flex-col gap-6">
        <h2 className="font-display text-heading font-semibold">
          Review scheduling
        </h2>

        <WeightFitPanel
          existing={existing}
          reviewCount={reviews.length}
          minReviews={MIN_REVIEWS_TO_FIT}
        />
      </section>
    </div>
  );
}
