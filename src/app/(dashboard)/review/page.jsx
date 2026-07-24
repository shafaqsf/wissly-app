import ReviewSession from '@/components/review/review-session';
import { rateArtefactAction, gradeAnswerAction } from '@/lib/actions/review';
import { dueArtefacts } from '@/lib/data/review';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Review — wissly',
};

/* The daily surface. What is due comes from `artefact_schedule`, which
   resolves each artefact's latest review into its current FSRS state; nothing
   on this page re-derives it. */
export default async function ReviewPage() {
  const supabase = await createClient();
  const artefacts = await dueArtefacts(supabase);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">Today</p>
        <h1 className="font-display text-display-l font-bold">Review</h1>
      </header>

      <ReviewSession
        artefacts={artefacts}
        onRateAction={rateArtefactAction}
        onGradeAction={gradeAnswerAction}
      />
    </div>
  );
}
