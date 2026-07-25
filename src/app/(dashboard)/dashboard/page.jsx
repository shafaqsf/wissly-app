import { Suspense } from 'react';

import Panel from '@/components/panel/panel';
import PanelGrid from '@/components/panel/panel-grid';
import PanelSkeleton from '@/components/panel/panel-skeleton';
import { listConceptMastery } from '@/lib/data/concepts';
import { dueArtefacts } from '@/lib/data/review';
import { listSources } from '@/lib/data/sources';
import { listSubjects } from '@/lib/data/subjects';
import { averageMastery, MASTERED_AT, masteryState } from '@/lib/mastery';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Dashboard — wissly',
};

/* Each panel awaits its own data. A slow one holds up nothing but itself:
   Suspense shows its skeleton, and the settle happens per panel.

   No panel here shows a percentage or a bar. Mastery is grain, on the
   progress page, and there is no second progress display. */

async function SubjectsPanel() {
  const supabase = await createClient();
  const subjects = await listSubjects(supabase);

  return (
    <Panel
      title="Subjects"
      empty={
        subjects.length === 0
          ? 'Add material and the subject it belongs to will appear here.'
          : undefined
      }
    >
      <ul className="flex flex-col gap-3">
        {subjects.map((subject) => (
          <li key={subject.id} className="text-body-s">
            {subject.title}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* The page's state, on the panel that reports it. The average across every
   concept the learner has is what "how am I doing" means, and Today is the
   panel that answers that question — so the mark goes here rather than on the
   page header, which is a position and not a state. */
async function DuePanel() {
  const supabase = await createClient();
  const [due, concepts] = await Promise.all([
    dueArtefacts(supabase),
    listConceptMastery(supabase),
  ]);

  const mastered = concepts.filter((concept) => concept.mastery >= MASTERED_AT).length;
  const state = masteryState(averageMastery(concepts));

  return (
    <Panel title="Today" mark={state}>
      <dl className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-body-s text-ink-muted">Due now</dt>
          <dd className="font-mono text-body-s">{due.length}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-body-s text-ink-muted">Concepts settled</dt>
          <dd className="font-mono text-body-s">
            {mastered} / {concepts.length}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

/* Ink on paper. The header used to be the page's field, which meant the one
   coloured surface on the dashboard was describing a title block rather than
   any state the learner has. The state moved to the Today panel. */
function DashboardHeader() {
  return (
    <header className="flex flex-col gap-2">
      <p className="font-mono text-label uppercase text-ink-muted">Your work</p>
      <h1 className="font-display text-display-l font-bold">Dashboard</h1>
    </header>
  );
}

async function MaterialPanel() {
  const supabase = await createClient();
  const sources = await listSources(supabase);

  return (
    <Panel
      title="Recent material"
      wide
      empty={
        sources.length === 0
          ? 'Nothing yet. Add a page of notes in the library and wissly will read it.'
          : undefined
      }
    >
      <ul className="flex flex-col gap-3">
        {sources.slice(0, 5).map((source) => (
          <li key={source.id} className="text-body-s">
            {source.title}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <DashboardHeader />

      <PanelGrid>
        <Suspense fallback={<PanelSkeleton title="Subjects" />}>
          <SubjectsPanel />
        </Suspense>

        <Suspense fallback={<PanelSkeleton title="Today" />}>
          <DuePanel />
        </Suspense>

        <Suspense fallback={<PanelSkeleton title="Recent material" wide />}>
          <MaterialPanel />
        </Suspense>
      </PanelGrid>
    </div>
  );
}
