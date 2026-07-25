import TaskWorkbench from '@/components/task/task-workbench';
import TasksFrame from '@/components/task/tasks-frame';
import { loadWorkbench } from '@/components/task/frame-data';
import { TASK_TYPES } from '@/components/task/task-types';
import {
  archiveTasksAction,
  moveTasksAction,
  rescheduleTasksAction,
  restoreTasksAction,
  updateTaskAction,
} from '@/lib/actions/task';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Archive — wissly',
};

/* What was put away, by type, still selectable and still restorable.

   Destruction is soft everywhere the agent can reach, so this is where two
   hundred cards archived by one wrong click come back from. Nothing here
   generates: an archive is a record, not a workbench. */
export default async function TaskArchivePage({ searchParams }) {
  const { course = '' } = (await searchParams) ?? {};
  const supabase = await createClient();

  const { courses, counts, tasks, sources, courseName } = await loadWorkbench(supabase, {
    courseId: course,
    archived: true,
  });

  const present = TASK_TYPES.filter((type) =>
    tasks.some((task) => task.format === type.format),
  );

  return (
    <TasksFrame
      active="archive"
      courseId={course}
      courses={courses}
      counts={counts}
      title="Archive"
    >
      {present.length === 0 ? (
        <p className="max-w-measure text-body">
          Nothing archived. What you archive lands here and can be restored,
          keeping the passage it was written from.
        </p>
      ) : (
        present.map((type) => (
          <section key={type.slug} aria-label={type.label} className="flex flex-col gap-4">
            <h3 className="font-display text-title font-semibold">{type.label}</h3>
            <TaskWorkbench
              type={type}
              courseId={course}
              courseName={courseName}
              courses={courses}
              tasks={tasks.filter((task) => task.format === type.format)}
              sources={sources}
              archived
              actions={{
                update: updateTaskAction,
                archive: archiveTasksAction,
                restore: restoreTasksAction,
                move: moveTasksAction,
                reschedule: rescheduleTasksAction,
              }}
            />
          </section>
        ))
      )}
    </TasksFrame>
  );
}
