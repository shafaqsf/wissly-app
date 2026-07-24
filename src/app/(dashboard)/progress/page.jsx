import ConceptMastery from '@/components/progress/concept-mastery';
import { conceptsFixture } from '@/lib/artefact-fixtures';

export const metadata = {
  title: 'Progress — wissly',
};

/* Progress is grain and nothing else. The field on this page is the only one
   the viewport gets. */
export default function ProgressPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">
          What you know
        </p>
        <h1 className="font-display text-display-l font-bold">Progress</h1>
      </header>

      <ConceptMastery subject="Linear algebra" concepts={conceptsFixture} />
    </div>
  );
}
