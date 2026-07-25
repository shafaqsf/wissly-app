import CoursePicker from './course-picker';
import TypeNav from './type-nav';

/* The frame every task surface sits in: the course picker across the top, the
   types down the left, the working surface on the right.

   It is a component rather than a `layout.jsx` because the course is a query
   parameter and a layout is not given one. Each page reads its own search
   params and hands them here, which also keeps the counts on the left honest:
   they are counted for the course that is actually being looked at. */
export default function TasksFrame({
  active,
  courseId = '',
  courses = [],
  counts = {},
  title,
  children,
}) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-label uppercase text-ink-muted">What you can do</p>
          <h1 className="font-display text-display-l font-bold">Tasks</h1>
        </div>
        <CoursePicker courses={courses} courseId={courseId} />
      </header>

      {/* One column at 360px, two from `md`. The nav comes first in the
          document either way, so the type is chosen before its surface is
          read — by the eye and by a screen reader alike. */}
      <div className="flex flex-col gap-8 md:grid md:grid-cols-[14rem_1fr] md:items-start md:gap-10">
        <TypeNav active={active} courseId={courseId} counts={counts} />

        <section aria-label={title} className="flex min-w-0 flex-col gap-6">
          <h2 className="font-display text-heading font-semibold">{title}</h2>
          {children}
        </section>
      </div>
    </div>
  );
}
