import Link from 'next/link';

import ImportForm from '@/components/library/import-form';
import Panel from '@/components/panel/panel';
import { importCourseAction } from '@/lib/actions/library';
import { currentUserId } from '@/lib/auth/user';
import { listPublicCourses } from '@/lib/data/library';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Library — wissly',
};

/* `/library` used to redirect to `/courses` (v0.14.0 folded the old reading
   library into the course page). v0.23.0 gives the address a new, unrelated
   meaning: courses another learner has published, browsable without a
   session because that is the point of a public library — importing is the
   only part that needs one, so a signed-out visitor sees a sign-in link
   where a signed-in one sees the Import button. This is not a fifth area
   (see src/components/nav/nav-items.js); it is reachable from Courses. */
export default async function LibraryPage() {
  const supabase = await createClient();

  const [courses, userId] = await Promise.all([
    listPublicCourses(supabase),
    currentUserId(supabase),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">
          Published by other learners
        </p>
        <h1 className="font-display text-display-l font-bold">Library</h1>
      </header>

      <Panel
        title="Public courses"
        empty={
          courses.length === 0
            ? 'Nobody has published a course yet. A course becomes public from its own page.'
            : undefined
        }
      >
        <ul className="motion-stagger flex flex-col gap-3">
          {courses.map((course) => (
            <li
              key={course.id}
              className="flex items-center justify-between gap-4 rounded-surface border border-rule px-5 py-3"
            >
              <span className="font-display text-body-l">{course.title}</span>
              {userId ? (
                <ImportForm courseId={course.id} action={importCourseAction} />
              ) : (
                <Link
                  href="/sign-in"
                  className="rounded-control px-2 py-1 font-mono text-label text-ink-muted hover:text-ink"
                >
                  Sign in to import
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
