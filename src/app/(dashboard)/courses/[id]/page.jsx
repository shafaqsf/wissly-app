import Link from 'next/link';
import { notFound } from 'next/navigation';

import CourseArchive from '@/components/course/course-archive';
import ExamPace from '@/components/course/exam-pace';
import ExportReading from '@/components/course/export-reading';
import ConceptShelf from '@/components/course/concept-shelf';
import ReadingShelf from '@/components/course/reading-shelf';
import SourceShelf from '@/components/course/source-shelf';
import AddMaterialForm from '@/components/material/add-material-form';
import EmptyState from '@/components/empty/empty-state';
import Panel from '@/components/panel/panel';
import {
  archiveReadingAction,
  archiveSourceAction,
  restoreReadingAction,
  restoreSourceAction,
  setExamDateAction,
} from '@/lib/actions/course';
import { addMaterialAction } from '@/lib/actions/material';
import { READING_FORMATS, TASK_FORMATS } from '@/lib/agent/formats';
import { listArtefacts } from '@/lib/data/artefacts';
import { listConceptMastery } from '@/lib/data/concepts';
import { courseAccent } from '@/lib/course-accent';
import { courseById } from '@/lib/data/courses';
import { dailyGoalFor } from '@/lib/data/daily-goal';
import { examPlanFor } from '@/lib/data/exam-plan';
import { listSourcesWithSections } from '@/lib/data/sources';
import { createClient } from '@/lib/supabase/server';

/* The shelf. One course, everything filed under it, and the place material
   comes in from now on.

   Reading is here and tasks are not, and that is the decision the whole
   restructuring turns on: understanding lives with the material, recall lives
   with the tasks. Tasks get one line and a link — rebuilding a task surface
   here would be the second copy this document exists to prevent.

   Every panel says what to do next when it is empty. Nothing is generated on
   upload any more, so a new course is empty by design, and an empty state that
   only reports emptiness would be the whole product for a new learner. */

export async function generateMetadata({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const course = await courseById(supabase, { id });

  return { title: course ? `${course.title} — wissly` : 'Course — wissly' };
}

function count(amount, singular, plural = `${singular}s`) {
  return `${amount} ${amount === 1 ? singular : plural}`;
}

export default async function CoursePage({ params, searchParams }) {
  const { id } = await params;
  // Analytics' gap report links here as `/courses/[id]?source=<id>`.
  const { source: askedFor = null } = (await searchParams) ?? {};
  const supabase = await createClient();

  const course = await courseById(supabase, { id });

  if (!course) notFound();

  const [sources, concepts, reading, tasks, archivedSources, archivedReading, goal] =
    await Promise.all([
      listSourcesWithSections(supabase, { subjectId: id }),
      listConceptMastery(supabase, { subjectId: id }),
      listArtefacts(supabase, { subjectId: id, formats: READING_FORMATS }),
      listArtefacts(supabase, { subjectId: id, formats: TASK_FORMATS }),
      listSourcesWithSections(supabase, { subjectId: id, archived: true }),
      listArtefacts(supabase, { subjectId: id, formats: READING_FORMATS, archived: true }),
      dailyGoalFor(supabase, { subjectId: id }),
    ]);

  // Only a course with an exam date has anything to compress a plan against.
  const plan = goal.examDate ? await examPlanFor(supabase, { subjectId: id }) : null;

  /* A link outlives what it points at. A source archived since the link was
     made is not an error and not a 404 — it is still here, one panel down, so
     the page says where it went rather than silently opening nothing. A source
     this course never had says nothing at all: there is nothing useful to tell
     a learner about an id they did not type. */
  const archivedMatch = askedFor
    ? archivedSources.find((source) => source.id === askedFor)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-mono text-label uppercase text-ink-muted">
          {/* The course's own tag — task item 6 in v0.15 — the same colour
              this course wears on the shelf in /courses. */}
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-round"
            style={{ backgroundColor: courseAccent(course.id) }}
          />
          Course
        </p>
        <h1 className="font-display text-display-l font-bold">{course.title}</h1>
        <p className="font-mono text-caption uppercase text-ink-muted">
          {count(sources.length, 'source')} · {course.settled} of{' '}
          {count(concepts.length, 'concept')} settled
        </p>
      </header>

      <Panel title="Exam">
        <ExamPace
          courseId={course.id}
          action={setExamDateAction}
          examDate={goal.examDate}
          goal={goal}
          plan={plan}
        />
      </Panel>

      <Panel title="Add material">
        <AddMaterialForm action={addMaterialAction} courseId={course.id} />
      </Panel>

      <Panel
        title="Sources"
        empty={
          sources.length === 0 ? (
            <EmptyState variant="shelf">
              Add your first material above. wissly reads it, cuts it into
              sections and names what each one covers.
            </EmptyState>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          {archivedMatch ? (
            // Not a failure, so no 2px rule: it is a fact about where the
            // thing went, and the archive that holds it is on this page.
            <p className="max-w-measure text-body-s text-ink-muted">
              {archivedMatch.title} is archived. Restore it below to read it
              again.
            </p>
          ) : null}

          <SourceShelf
            courseId={course.id}
            sources={sources}
            archiveAction={archiveSourceAction}
            openSourceId={askedFor}
          />
        </div>
      </Panel>

      <Panel
        title="Concepts"
        empty={
          concepts.length === 0
            ? 'Concepts appear as soon as material is read — one per section, named from the source.'
            : undefined
        }
      >
        <ConceptShelf concepts={concepts} />
      </Panel>

      <Panel
        title="Reading"
        action={<ExportReading title={course.title} artefacts={reading} />}
        empty={
          reading.length === 0
            ? 'Summaries and glossary entries you generate land here, beside the material they came from.'
            : undefined
        }
      >
        <ReadingShelf
          courseId={course.id}
          artefacts={reading}
          archiveAction={archiveReadingAction}
        />
      </Panel>

      {/* A line, not a copy. */}
      <Link
        href={`/tasks?course=${course.id}`}
        className="motion-lift flex min-h-11 items-center rounded-surface border border-rule px-5 py-3 font-mono text-label uppercase text-ink"
      >
        {tasks.length === 0 ? 'No tasks yet — write or generate some' : count(tasks.length, 'task')}{' '}
        →
      </Link>

      <Panel title="Archive">
        <CourseArchive
          courseId={course.id}
          sources={archivedSources}
          artefacts={archivedReading}
          restoreSourceAction={restoreSourceAction}
          restoreReadingAction={restoreReadingAction}
        />
      </Panel>
    </div>
  );
}
