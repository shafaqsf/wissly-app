import Link from 'next/link';

import { listCourses } from '@/lib/data/courses';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Courses — wissly',
};

/* One line per course, and the line says the two things a learner asks first:
   how much is in here, and how much of it has settled. Neither is a bar or a
   percentage — mastery is grain and depth, and both live on the progress page,
   which is where each course here leads. */

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

      {courses.length === 0 ? (
        // A card, and nothing behind the words. The tint this used to carry
        // said "unresolved" in grey across the full width of the page, which
        // is a background wherever you put it — see "The field" in
        // docs/DESIGN.md. The copy already says there is nothing here.
        <div className="flex flex-col items-start justify-center gap-6 rounded-surface border border-rule px-6 py-10">
          <p className="max-w-measure text-body">
            No courses yet. Add a page of your notes and wissly will read it,
            name what it covers and file it under a course.
          </p>
          <Link
            href="/library"
            className="inline-flex min-h-11 items-center rounded-control border border-rule px-4 font-mono text-label uppercase text-ink"
          >
            Add your first material
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col border-t border-rule">
          {courses.map((course) => (
            <li key={course.id} className="border-b border-rule">
              <Link
                href={`/progress?subject=${course.id}`}
                className="flex min-h-11 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
              >
                <span className="text-body">{course.title}</span>
                <span className="font-mono text-caption uppercase text-ink-muted">
                  {count(course.sources, 'source')} · {course.settled} of{' '}
                  {count(course.concepts, 'concept')} settled
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
