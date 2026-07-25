import { notFound } from 'next/navigation';

import TaskWorkbench from '@/components/task/task-workbench';
import TasksFrame from '@/components/task/tasks-frame';
import { loadWorkbench } from '@/components/task/frame-data';
import { typeBySlug } from '@/components/task/task-types';
import {
  archiveTasksAction,
  createTaskAction,
  generateTasksAction,
  moveTasksAction,
  rescheduleTasksAction,
  restoreTasksAction,
  sectionsWithFormatAction,
  updateTaskAction,
} from '@/lib/actions/task';
import { createClient } from '@/lib/supabase/server';

/* One type, one surface. Four addresses out of one file, because what differs
   between them is the working surface and not the page around it.

   No `generateStaticParams`: every one of these reads the learner's own rows
   behind a session cookie, so there is nothing here to prerender. */

export async function generateMetadata({ params }) {
  const type = typeBySlug((await params).type);
  return { title: type ? `${type.label} — wissly` : 'Tasks — wissly' };
}

export default async function TaskTypePage({ params, searchParams }) {
  const { type: slug } = await params;
  const { course = '' } = (await searchParams) ?? {};

  const type = typeBySlug(slug);
  if (!type) notFound();

  const supabase = await createClient();
  const { courses, counts, tasks, sources, courseName } = await loadWorkbench(supabase, {
    courseId: course,
  });

  return (
    <TasksFrame
      active={type.slug}
      courseId={course}
      courses={courses}
      counts={counts}
      title={type.label}
    >
      <TaskWorkbench
        type={type}
        courseId={course}
        courseName={courseName}
        courses={courses}
        tasks={tasks.filter((task) => task.format === type.format)}
        sources={sources}
        actions={{
          create: createTaskAction,
          update: updateTaskAction,
          generate: generateTasksAction,
          duplicates: sectionsWithFormatAction,
          archive: archiveTasksAction,
          restore: restoreTasksAction,
          move: moveTasksAction,
          reschedule: rescheduleTasksAction,
        }}
      />
    </TasksFrame>
  );
}
