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

async function DuePanel() {
  const supabase = await createClient();
  const [due, concepts] = await Promise.all([
    dueArtefacts(supabase),
    listConceptMastery(supabase),
  ]);

  const mastered = concepts.filter((concept) => concept.mastery >= MASTERED_AT).length;

  return (
    <Panel title="Today">
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

/* The page's one field, and the only thing on the dashboard that reads the
   learner's whole position at once: the average across every concept they
   have. It is a header, so it says where you are before it says anything
   about what is due. */
async function DashboardHeader() {
  const supabase = await createClient();
  const concepts = await listConceptMastery(supabase);
  const state = masteryState(averageMastery(concepts));

  return (
    <header
      className={`grain grain-field ${state.field} flex flex-col gap-2 px-6 py-10 md:px-10 md:py-14`}
      style={{ '--grain': state.grain }}
    >
      <p className="font-mono text-label uppercase text-ink">Your work</p>
      <h1 className="font-display text-display-l font-bold">Dashboard</h1>
    </header>
  );
}

/* The header before its concepts arrive. Same box, no field — an empty field
   would claim a state the page has not read yet. */
function DashboardHeaderSkeleton() {
  return (
    <header className="flex flex-col gap-2 px-6 py-10 md:px-10 md:py-14">
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
      // No field here. The header took the page's one field, and two would
      // read as a texture pack rather than as a signal.
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
      <Suspense fallback={<DashboardHeaderSkeleton />}>
        <DashboardHeader />
      </Suspense>

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
