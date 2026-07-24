import ReviewSession from '@/components/review/review-session';
import { reviewQueueFixture } from '@/lib/artefact-fixtures';

export const metadata = {
  title: 'Review — wissly',
};

/* The daily surface. The queue is a fixture until the scheduler exists; the
   page will hand it the same array either way. */
export default function ReviewPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">Today</p>
        <h1 className="font-display text-display-l font-bold">Review</h1>
      </header>

      <ReviewSession artefacts={reviewQueueFixture} />
    </div>
  );
}
