import { Suspense } from 'react';

import PanelGrid from '@/components/panel/panel-grid';
import PanelSkeleton from '@/components/panel/panel-skeleton';

import {
  ActionPanel,
  AgentChangesPanel,
  CoursesPanel,
  EffortPanel,
  RecentlyPanel,
  StreakPanel,
  WeakestPanel,
  WeekPanel,
} from './panels';

export const metadata = {
  title: 'Dashboard — wissly',
};

/* One page answering "what now".

   Every surface here is an entrance and nothing is decoration: each panel
   leads somewhere, and the ones that cannot lead anywhere yet say what the
   next step is and offer it. Nothing is generated on upload any more, so a
   new account meets eight empty panels — and each of them has to be worth
   meeting.

   Reading order is the order of the day: what to do, what happened without
   you, what is weak, what you have, what just moved, how often you turned up,
   what it cost.

   Each panel awaits its own data inside its own boundary. A slow one shows
   its own skeleton and holds up nothing else. */
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">Today</p>
        <h1 className="font-display text-display-l font-bold">Dashboard</h1>
      </header>

      <PanelGrid>
        <Suspense fallback={<PanelSkeleton title="The action" wide />}>
          <ActionPanel />
        </Suspense>

        <Suspense fallback={<PanelSkeleton title="What the agent changed" wide />}>
          <AgentChangesPanel />
        </Suspense>

        <Suspense fallback={<PanelSkeleton title="Weakest" />}>
          <WeakestPanel />
        </Suspense>

        <Suspense fallback={<PanelSkeleton title="Courses" />}>
          <CoursesPanel />
        </Suspense>

        <Suspense fallback={<PanelSkeleton title="Recently" />}>
          <RecentlyPanel />
        </Suspense>

        <Suspense fallback={<PanelSkeleton title="Streak" />}>
          <StreakPanel />
        </Suspense>

        <Suspense fallback={<PanelSkeleton title="This week" />}>
          <WeekPanel />
        </Suspense>

        <Suspense fallback={<PanelSkeleton title="Effort" wide />}>
          <EffortPanel />
        </Suspense>
      </PanelGrid>
    </div>
  );
}
