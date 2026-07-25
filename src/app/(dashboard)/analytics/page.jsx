import Link from 'next/link';

import DayBars from '@/components/analytics/day-bars';
import Effort from '@/components/analytics/effort';
import GapReport from '@/components/analytics/gap-report';
import Panel from '@/components/panel/panel';
import ConceptMastery from '@/components/progress/concept-mastery';
import { effortByDay, gapConcepts, reviewsByDay } from '@/lib/data/agent-runs';
import { listConceptMastery } from '@/lib/data/concepts';
import { listSubjects } from '@/lib/data/subjects';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Analytics — wissly',
};

/** A month is long enough to see a habit and short enough to read at a glance. */
const HISTORY_DAYS = 30;

/* Analytics replaces `/progress`, and the difference is what it can say.

   The progress page had one thing on it: a column of marks saying how much is
   unresolved. That is a measurement, and a measurement you cannot act on is a
   mood. This page keeps the marks and adds the three answers they never gave —
   *what* does not hold, *when* you worked, and *what it cost*.

   One grain field on this viewport, and it is the mastery column: the heading
   and its rows are one legend. The gap report, the history and the effort
   panels are ink, hairlines and words. A second column of marks beside the gap
   names would say the same state twice and turn the page into texture. */
export default async function AnalyticsPage({ searchParams }) {
  const supabase = await createClient();
  const params = (await searchParams) ?? {};

  const subjects = await listSubjects(supabase);
  const selected =
    subjects.find((subject) => subject.id === params.course) ?? subjects[0] ?? null;
  const subjectId = selected?.id;

  const [concepts, gaps, effort, history] = await Promise.all([
    subjectId ? listConceptMastery(supabase, { subjectId }) : [],
    subjectId ? gapConcepts(supabase, { subjectId }) : [],
    effortByDay(supabase),
    reviewsByDay(supabase, { days: HISTORY_DAYS }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">What you know</p>
        <h1 className="font-display text-display-l font-bold">Analytics</h1>
      </header>

      {subjects.length > 1 ? (
        <nav aria-label="Courses" className="flex flex-wrap gap-x-6 gap-y-2">
          {subjects.map((subject) => (
            <Link
              key={subject.id}
              href={`/analytics?course=${subject.id}`}
              aria-current={subject.id === selected?.id ? 'page' : undefined}
              className="inline-flex min-h-11 items-center font-mono text-label uppercase text-ink-muted aria-[current=page]:text-ink"
            >
              {subject.title}
            </Link>
          ))}
        </nav>
      ) : null}

      {selected ? (
        // The one grain field on this viewport.
        <ConceptMastery
          subject={selected.title}
          concepts={concepts}
          initialConceptId={params.concept ?? null}
        />
      ) : (
        <div className="flex flex-col items-start gap-4">
          <p className="max-w-measure text-body text-ink-muted">
            Nothing to measure yet. Start a course, add a page of notes, and this
            page fills itself in as you answer.
          </p>
          <Link
            href="/courses"
            className="motion-lift inline-flex min-h-11 items-center rounded-control border border-rule px-4 font-mono text-label uppercase"
          >
            Add your first material
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="What does not hold yet">
          <GapReport gaps={gaps} />
        </Panel>

        <Panel title="History">
          <div className="flex flex-col gap-3">
            <DayBars label="Reviews per day" days={
              history.map((day) => ({ date: day.date, value: day.reviews }))
            } unit="review" />
            <p className="font-mono text-caption text-ink-muted">
              Reviews per day, over thirty days.
            </p>
          </div>
        </Panel>

        <Panel title="Effort" wide>
          <Effort days={effort} />
        </Panel>
      </div>
    </div>
  );
}
