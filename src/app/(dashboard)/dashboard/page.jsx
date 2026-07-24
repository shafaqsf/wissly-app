import { Suspense } from 'react';
import Panel from '@/components/panel/panel';
import PanelGrid from '@/components/panel/panel-grid';
import PanelSkeleton from '@/components/panel/panel-skeleton';
import {
  getCourses,
  getProgressSummary,
  getRecentLessons,
} from '@/lib/placeholder-data';

export const metadata = {
  title: 'Dashboard — wissly',
};

/* Each panel awaits its own data. A slow one holds up nothing but itself:
   Suspense shows its skeleton, and the settle happens per panel. */

async function CoursesPanel() {
  const courses = await getCourses();

  return (
    <Panel
      title="Courses"
      empty={
        courses.length === 0
          ? 'Start a course and it will follow your progress here.'
          : undefined
      }
    >
      <ul className="flex flex-col gap-4">
        {courses.map((course) => (
          <li key={course.id} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-body-s">{course.title}</span>
              <span className="font-mono text-caption text-ink-muted">
                {Math.round(course.progress * 100)}%
              </span>
            </div>
            <div className="h-px w-full bg-rule">
              <div
                className="h-px bg-ink"
                style={{ width: `${Math.round(course.progress * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

async function ProgressPanel() {
  const { lessonsCompleted, lessonsTotal, streakDays } =
    await getProgressSummary();

  return (
    <Panel title="Progress">
      <dl className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-body-s text-ink-muted">Lessons completed</dt>
          <dd className="font-mono text-body-s">
            {lessonsCompleted} / {lessonsTotal}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-body-s text-ink-muted">Days in a row</dt>
          <dd className="font-mono text-body-s">{streakDays}</dd>
        </div>
      </dl>
    </Panel>
  );
}

async function RecentLessonsPanel() {
  const lessons = await getRecentLessons();

  return (
    <Panel
      title="Recent lessons"
      wide
      empty={
        lessons.length === 0
          ? 'Finish a lesson and it will show up here.'
          : undefined
      }
    >
      <ul className="flex flex-col gap-3">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="text-body-s">
            {lesson.title}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">
          Your work
        </p>
        <h1 className="font-display text-display-l font-bold">Dashboard</h1>
      </header>

      <PanelGrid>
        <Suspense fallback={<PanelSkeleton title="Courses" />}>
          <CoursesPanel />
        </Suspense>

        <Suspense fallback={<PanelSkeleton title="Progress" />}>
          <ProgressPanel />
        </Suspense>

        <Suspense fallback={<PanelSkeleton title="Recent lessons" wide />}>
          <RecentLessonsPanel />
        </Suspense>
      </PanelGrid>
    </div>
  );
}
