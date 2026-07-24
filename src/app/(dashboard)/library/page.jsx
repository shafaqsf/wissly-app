import Artefact from '@/components/artefact/artefact';
import { glossaryFixture, summaryFixture } from '@/lib/artefact-fixtures';

export const metadata = {
  title: 'Library — wissly',
};

/* The understanding formats: read rather than answered, so they live outside
   the review queue. Fixtures until the generation layer lands. */
export default function LibraryPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">
          Your material
        </p>
        <h1 className="font-display text-display-l font-bold">Library</h1>
      </header>

      <div className="flex flex-col gap-16">
        <Artefact artefact={summaryFixture} />
        <Artefact artefact={glossaryFixture} />
      </div>
    </div>
  );
}
