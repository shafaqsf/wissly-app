'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/* Which course the workbench is looking at, or all of them.

   It is a query parameter rather than a path segment because it is orthogonal
   to the type: switching from Flashcards to Cloze keeps the course, and
   switching course keeps the type. Both are one navigation, and the address
   bar carries the whole state, so a workbench is linkable. */
export default function CoursePicker({ courses = [], courseId = '' }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function choose(value) {
    const next = new URLSearchParams(params?.toString() ?? '');

    if (value) next.set('course', value);
    else next.delete('course');

    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="course-picker" className="font-mono text-label uppercase text-ink-muted">
        Course
      </label>
      <select
        id="course-picker"
        value={courseId}
        onChange={(event) => choose(event.target.value)}
        className="min-h-11 rounded-control border border-rule bg-paper px-3 text-body text-ink"
      >
        <option value="">All courses</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.title}
          </option>
        ))}
      </select>
    </div>
  );
}
