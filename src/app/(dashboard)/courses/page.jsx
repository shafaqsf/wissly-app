import Link from 'next/link';

import CreateCourseForm from '@/components/course/create-course-form';
import EmptyState from '@/components/empty/empty-state';
import Panel from '@/components/panel/panel';
import { createCourseAction } from '@/lib/actions/course';
import { courseAccent } from '@/lib/course-accent';
import { listCourses } from '@/lib/data/courses';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Courses — wissly',
};

/* Two things: start a course, and open one.

   The line says what a learner asks first — how much is in here, and how much
   of it has settled. Neither is a bar or a percentage; mastery is grain, and
   it is on the shelf each of these leads to. */

function count(amount, singular, plural = `${singular}s`) {
  return `${amount} ${amount === 1 ? singular : plural}`;
}

export default async function CoursesPage() {
  const supabase = await createClient();
  const courses = await listCourses(supabase);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">
          What you are learning
        </p>
        <h1 className="font-display text-display-l font-bold">Courses</h1>
      </header>

      <Panel title="Start a course">
        <div className="flex flex-col gap-4">
          <p className="max-w-measure text-body-s text-ink-muted">
            A course is a shelf. Name it, then add the material it holds.
          </p>
          <CreateCourseForm action={createCourseAction} />
        </div>
      </Panel>

      <Panel
        title="Your courses"
        empty={
          courses.length === 0 ? (
            <EmptyState variant="shelf">
              Name your first course above. Its shelf opens empty, and the
              material goes in there.
            </EmptyState>
          ) : undefined
        }
      >
        <ul className="motion-stagger flex flex-col gap-3">
          {courses.map((course) => (
            <li key={course.id}>
              {/* The lift darkens a hairline, so the row has to have one —
                  see "Motion" in docs/DESIGN.md. A row with a transparent
                  border would rise and say nothing. The tag is the course's
                  own accent — task item 6 in v0.15 — derived from its id so
                  the same course always wears the same colour. */}
              <Link
                href={`/courses/${course.id}`}
                className="motion-lift flex min-h-11 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-control border border-rule px-4 py-3"
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-round"
                    style={{ backgroundColor: courseAccent(course.id) }}
                  />
                  <span className="text-body">{course.title}</span>
                </span>
                <span className="font-mono text-caption uppercase text-ink-muted">
                  {count(course.sources, 'source')} · {course.settled} of{' '}
                  {count(course.concepts, 'concept')} settled
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      {/* A line, not a copy. */}
      <Link
        href="/library"
        className="motion-lift flex min-h-11 items-center rounded-surface border border-rule px-5 py-3 font-mono text-label uppercase text-ink"
      >
        Browse the public library →
      </Link>
    </div>
  );
}
