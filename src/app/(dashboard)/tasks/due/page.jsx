import ReviewSession from '@/components/review/review-session';
import TasksFrame from '@/components/task/tasks-frame';
import { loadWorkbench } from '@/components/task/frame-data';
import { gradeAnswerAction, rateArtefactAction } from '@/lib/actions/review';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Due — wissly',
};

/* The queue, mixed across every type. This was `/review`, and it moved here
   because what is due is not a sixth area — it is the workbench's own first
   entry, the one that answers "what now" rather than "what have I got".

   What is due comes from `artefact_schedule`, which resolves each row's latest
   review into its current FSRS state; nothing on this page re-derives it. */
export default async function DuePage({ searchParams }) {
  const { course = '' } = (await searchParams) ?? {};
  const supabase = await createClient();

  const { courses, counts, due } = await loadWorkbench(supabase, { courseId: course });

  return (
    <TasksFrame active="due" courseId={course} courses={courses} counts={counts} title="Due">
      <ReviewSession
        artefacts={due}
        onRateAction={rateArtefactAction}
        onGradeAction={gradeAnswerAction}
      />
    </TasksFrame>
  );
}
