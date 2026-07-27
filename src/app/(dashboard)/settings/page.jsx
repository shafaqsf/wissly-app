import SignOutButton from '@/components/auth/sign-out-button';
import ExportImportPanel from '@/components/settings/export-import-panel';
import ModelPreferenceForm from '@/components/settings/model-preference-form';
import WeeklyReportPreview from '@/components/settings/weekly-report-preview';
import WeightFitPanel from '@/components/settings/weight-fit-panel';
import { exportDataAction, importDataAction } from '@/lib/actions/export.js';
import { updateDefaultModelAction } from '@/lib/actions/settings.js';
import { reviewLogFor, weightsFor } from '@/lib/data/fsrs-weights.js';
import { getPreferences } from '@/lib/data/preferences.js';
import { MIN_REVIEWS_TO_FIT } from '@/lib/review/fit-weights.js';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Settings — wissly',
};

/* There used to be one setting worth the name — which account this is — and
   the one action beside it. Several more have earned their place: which model
   generation reaches for, review scheduling fitted from a learner's own
   history, carrying data out and back in, what to expect from the queue
   offline, and the weekly report — which is not a preference at all but a
   preview of what a weekly email would say if delivery existed, and belongs
   here because this is where the account lives. Each earns its place by being
   something a learner can act on or read; a page that listed switches nobody
   has built would be a promise, not a screen. When a real preference exists,
   it goes here. */
export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email ?? null;
  const preferences = await getPreferences(supabase);

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

      <section aria-label="Model" className="flex flex-col gap-6">
        <h2 className="font-display text-heading font-semibold">Model</h2>
        <ModelPreferenceForm
          defaultModel={preferences.default_model ?? ''}
          action={updateDefaultModelAction}
        />
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

      <section aria-label="Weekly report" className="flex flex-col gap-6">
        <h2 className="font-display text-heading font-semibold">Weekly report</h2>
        <p className="max-w-measure text-body-s text-ink-muted">
          A summary of reviews done, mastery, your streak and what is coming
          due — the same report a weekly email would carry. Delivery is not
          built yet, so this writes the report to the server log instead of
          sending it.
        </p>
        <WeeklyReportPreview />
      </section>

      <section aria-label="Export & import" className="flex flex-col gap-6">
        <h2 className="font-display text-heading font-semibold">Export & import</h2>
        <ExportImportPanel exportAction={exportDataAction} importAction={importDataAction} />
      </section>

      <section aria-label="Offline review" className="flex flex-col gap-6">
        <h2 className="font-display text-heading font-semibold">Offline review</h2>
        <p className="max-w-measure text-body-s text-ink-muted">
          Install wissly from your browser and the due queue stays open on a
          flaky connection: the last list it saw is what you get instead of a
          blank page, and a rating you give offline is held on your device and
          sent the moment the connection comes back — nothing is lost, and
          nothing needs a second try.
        </p>
      </section>
    </div>
  );
}
