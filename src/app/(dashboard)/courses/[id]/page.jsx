import Link from 'next/link';
import { notFound } from 'next/navigation';

import CourseArchive from '@/components/course/course-archive';
import ExportReading from '@/components/course/export-reading';
import ConceptShelf from '@/components/course/concept-shelf';
import LeaderboardPanel from '@/components/course/leaderboard-panel';
import ReadingShelf from '@/components/course/reading-shelf';
import SharePanel from '@/components/course/share-panel';
import SourceShelf from '@/components/course/source-shelf';
import VisibilityToggle from '@/components/course/visibility-toggle';
import AddMaterialForm from '@/components/material/add-material-form';
import Panel from '@/components/panel/panel';
import {
  archiveReadingAction,
  archiveSourceAction,
  restoreReadingAction,
  restoreSourceAction,
} from '@/lib/actions/course';
import { addMaterialAction } from '@/lib/actions/material';
import { revokeShareAction, setCourseVisibilityAction, shareCourseAction } from '@/lib/actions/share';
import { READING_FORMATS, TASK_FORMATS } from '@/lib/agent/formats';
import { currentUserId } from '@/lib/auth/user';
import { listArtefacts } from '@/lib/data/artefacts';
import { listConceptMastery } from '@/lib/data/concepts';
import { courseById } from '@/lib/data/courses';
import { subjectLeaderboard } from '@/lib/data/leaderboard';
import { listShares } from '@/lib/data/shares';
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
   only reports emptiness would be the whole product for a new learner.

   This page now also opens for a course that is not the viewer's own: a
   share or a public flag can put someone else's course in front of them
   (migrations/007). `isOwner` is the one flag every write-shaped panel below
   checks — Add material, Archive, Share, Visibility — because those write,
   and 007 never widens a write policy for a share or a public flag. Reading
   panels stay up for everyone the database already let in; only their
   archive controls hide, via `canEdit`. */

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

  const [course, userId] = await Promise.all([
    courseById(supabase, { id }),
    currentUserId(supabase),
  ]);

  if (!course) notFound();

  const isOwner = course.ownerId === userId;

  const [sources, concepts, reading, tasks, archivedSources, archivedReading, shares, leaderboard] =
    await Promise.all([
      listSourcesWithSections(supabase, { subjectId: id }),
      listConceptMastery(supabase, { subjectId: id }),
      listArtefacts(supabase, { subjectId: id, formats: READING_FORMATS }),
      listArtefacts(supabase, { subjectId: id, formats: TASK_FORMATS }),
      isOwner ? listSourcesWithSections(supabase, { subjectId: id, archived: true }) : [],
      isOwner
        ? listArtefacts(supabase, { subjectId: id, formats: READING_FORMATS, archived: true })
        : [],
      isOwner ? listShares(supabase, { subjectId: id }) : [],
      // Membership-gated in the database, not here: a caller who is only a
      // public visitor gets an empty list back, never another learner's row.
      subjectLeaderboard(supabase, { subjectId: id }),
    ]);

  const isMember = leaderboard.some((row) => row.memberId === userId);

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
        <p className="font-mono text-label uppercase text-ink-muted">
          {isOwner ? 'Course' : 'Shared course'}
        </p>
        <h1 className="font-display text-display-l font-bold">{course.title}</h1>
        <p className="font-mono text-caption uppercase text-ink-muted">
          {count(sources.length, 'source')} · {course.settled} of{' '}
          {count(concepts.length, 'concept')} settled
        </p>
      </header>

      {isOwner ? (
        <Panel title="Add material">
          <AddMaterialForm action={addMaterialAction} courseId={course.id} />
        </Panel>
      ) : null}

      <Panel
        title="Sources"
        empty={
          sources.length === 0
            ? isOwner
              ? 'Add your first material above. wissly reads it, cuts it into sections and names what each one covers.'
              : 'Nothing has been added to this course yet.'
            : undefined
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
            canEdit={isOwner}
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
          canEdit={isOwner}
        />
      </Panel>

      {isOwner ? (
        // A line, not a copy. The task surfaces are not rebuilt here.
        <Link
          href={`/tasks?course=${course.id}`}
          className="motion-lift flex min-h-11 items-center rounded-surface border border-rule px-5 py-3 font-mono text-label uppercase text-ink"
        >
          {tasks.length === 0 ? 'No tasks yet — write or generate some' : count(tasks.length, 'task')}{' '}
          →
        </Link>
      ) : null}

      {isOwner ? (
        <Panel title="Sharing">
          <div className="flex flex-col gap-6">
            <VisibilityToggle
              courseId={course.id}
              isPublic={course.isPublic}
              action={setCourseVisibilityAction}
            />
            <SharePanel
              courseId={course.id}
              shares={shares}
              shareAction={shareCourseAction}
              revokeAction={revokeShareAction}
            />
          </div>
        </Panel>
      ) : null}

      {isMember ? (
        <Panel title="Leaderboard">
          <LeaderboardPanel rows={leaderboard} currentUserId={userId} />
        </Panel>
      ) : null}

      {isOwner ? (
        <Panel title="Archive">
          <CourseArchive
            courseId={course.id}
            sources={archivedSources}
            artefacts={archivedReading}
            restoreSourceAction={restoreSourceAction}
            restoreReadingAction={restoreReadingAction}
          />
        </Panel>
      ) : null}
    </div>
  );
}
