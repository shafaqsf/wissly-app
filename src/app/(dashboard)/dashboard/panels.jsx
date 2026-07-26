import Link from 'next/link';

import DayBars from '@/components/analytics/day-bars';
import Effort from '@/components/analytics/effort';
import Panel from '@/components/panel/panel';
import {
  recentAgentActions,
  dueCounts,
  effortByDay,
  reviewsByDay,
} from '@/lib/data/agent-runs';
import { RECALL_FORMATS, listArtefacts } from '@/lib/data/artefacts';
import { listConceptMastery } from '@/lib/data/concepts';
import { listConversations } from '@/lib/data/conversations';
import { listCourses } from '@/lib/data/courses';
import { listSources } from '@/lib/data/sources';
import { streakFor } from '@/lib/data/streak';
import { masteryState } from '@/lib/mastery';
import { createClient } from '@/lib/supabase/server';

import { describeAction, destinationOf } from './activity';
import { undoAgentAction } from './actions';

/* The seven surfaces of the day, one file, one panel each.

   They live beside the page rather than inside it so that each one can be
   tested on its own data — and because the page's whole job is composition:
   seven `Suspense` boundaries, seven skeletons, and no panel able to hold up
   another.

   **One grain field on this viewport, and it is Weakest.** Six of these seven
   panels report a state of some kind, and a mark on each would turn the
   dashboard into a column of grey dots — texture, which is the one thing
   `DESIGN.md` forbids grain to become. So the field goes on the panel whose
   entire subject is how resolved things are, where five marks read as one
   legend; every other panel says its state in words and counts. Courses says
   "3 of 12 concepts settled" rather than wearing a mark, and it is not worse
   for it. */

const WEAKEST = 5;
const RECENT_WINDOW_DAYS = 7;

/** The one control style on this page: a hairline, a lift, and a verb. */
const actionClass =
  'motion-lift inline-flex min-h-11 items-center rounded-control border border-rule px-4 font-mono text-label uppercase';

const rowClass =
  'motion-lift flex min-h-11 flex-col justify-center gap-1 rounded-control py-3';

function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/* --- The action ------------------------------------------------------- */

/**
 * What now. The first thing on the page and the only one that is a verb.
 *
 * The count animates with `motion-count`, which draws its digits from a CSS
 * counter — so the sentence is also written out for anyone the counter does
 * not reach, which is a screen reader, a still screenshot and anybody with
 * reduced motion on.
 */
export async function ActionPanel() {
  const supabase = await createClient();
  const { due, overdue } = await dueCounts(supabase);

  if (due === 0) {
    return (
      <Panel
        title="The action"
        wide
        action={
          <Link href="/tasks" className={actionClass}>
            Make some tasks
          </Link>
        }
      >
        <p className="max-w-measure text-body-s text-ink-muted">
          Nothing is due. Generate tasks from a passage of your material and they
          will be waiting here tomorrow.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="The action"
      wide
      action={
        <Link href="/tasks/due" className={actionClass}>
          Start a round
        </Link>
      }
    >
      <p className="font-display text-heading font-semibold">
        <span
          aria-hidden="true"
          className="motion-count"
          data-count=""
          style={{ '--motion-count-value': due }}
        />
        <span aria-hidden="true">
          {' '}
          {due === 1 ? 'task due' : 'tasks due'} · {overdue} overdue
        </span>
        <span className="sr-only">
          {plural(due, 'task')} due, {overdue} overdue
        </span>
      </p>
    </Panel>
  );
}

/* --- What the agent changed ------------------------------------------- */

/**
 * The agent's recent writes, each row reversible.
 *
 * This panel used to list only what happened with nobody present. Autonomy is
 * only defensible if it is legible afterwards — but so is a turn the learner
 * started and then scrolled away from. Thirty rows written in one turn are
 * worth reviewing either way, so the panel reports every recent change and
 * offers the same `Undo` on each. A row that could not be taken back would be
 * a notification.
 */
export async function AgentChangesPanel() {
  const supabase = await createClient();
  const actions = await recentAgentActions(supabase, { limit: WEAKEST });

  return (
    <Panel
      title="What the agent changed"
      wide
      empty={
        actions.length === 0
          ? 'The agent has not changed anything yet. When it does, every change appears here with a way to take it back.'
          : undefined
      }
    >
      <ul className="motion-stagger flex flex-col">
        {actions.map((action) => (
          <li
            key={action.id}
            className="flex items-center justify-between gap-4 border-b border-rule last:border-b-0"
          >
            <Link href={destinationOf(action)} className={`${rowClass} flex-1`}>
              <span className="text-body-s">{describeAction(action)}</span>
            </Link>
            <form action={undoAgentAction}>
              <input type="hidden" name="actionId" value={action.id} />
              <button type="submit" className={actionClass}>
                Undo
              </button>
            </form>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* --- Weakest ---------------------------------------------------------- */

/** The five lowest, as marks. The one grain field on this viewport. */
export async function WeakestPanel() {
  const supabase = await createClient();
  const concepts = await listConceptMastery(supabase);

  const weakest = [...concepts].sort((a, b) => a.mastery - b.mastery).slice(0, WEAKEST);

  if (weakest.length === 0) {
    return (
      <Panel
        title="Weakest"
        action={
          <Link href="/tasks/due" className={actionClass}>
            Start a round
          </Link>
        }
      >
        <p className="max-w-measure text-body-s text-ink-muted">
          Nothing measured yet. Answer a round and the ideas that need work will
          surface here.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Weakest">
      <ul className="motion-stagger flex flex-col">
        {weakest.map((concept) => {
          const state = masteryState(concept.mastery);

          return (
            <li key={concept.id} className="border-b border-rule last:border-b-0">
              <Link
                href={`/analytics?concept=${concept.id}`}
                aria-label={`${concept.name}, ${state.label.toLowerCase()}`}
                className="motion-lift flex min-h-11 items-center justify-between gap-4 rounded-control py-3"
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`grain grain-mark mastery-gradient ${state.field}`}
                    style={{ '--grain': state.grain, '--mastery-color': state.color }}
                  />
                  <span className="text-body-s">{concept.name}</span>
                </span>
                {/* The word beside the mark. Twelve pixels of grey says
                    nothing on its own, and this column is the legend. */}
                <span className="font-mono text-caption uppercase text-ink-muted">
                  {state.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* --- Courses ---------------------------------------------------------- */

/** The shelf, counted in words. No mark: Weakest has the field. */
export async function CoursesPanel() {
  const supabase = await createClient();
  const courses = await listCourses(supabase);

  return (
    <Panel
      title="Courses"
      action={
        courses.length > 0 ? (
          <Link href="/courses" className={actionClass}>
            All
          </Link>
        ) : (
          <Link href="/courses" className={actionClass}>
            Start a course
          </Link>
        )
      }
      empty={
        courses.length === 0
          ? 'No course yet. Start one, add a page of notes, and everything else on this page fills itself in.'
          : undefined
      }
    >
      <ul className="motion-stagger flex flex-col">
        {courses.map((course) => (
          <li key={course.id} className="border-b border-rule last:border-b-0">
            <Link href={`/courses/${course.id}`} className={rowClass}>
              <span className="text-body-s">{course.title}</span>
              <span className="font-mono text-caption text-ink-muted">
                {plural(course.sources, 'source')} · {course.settled} of{' '}
                {plural(course.concepts, 'concept')} settled
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* --- Recently --------------------------------------------------------- */

/** The last of each thing, each leading to its own place. */
export async function RecentlyPanel() {
  const supabase = await createClient();

  const [sources, tasks, conversations] = await Promise.all([
    listSources(supabase),
    listArtefacts(supabase, { formats: RECALL_FORMATS }),
    listConversations(supabase),
  ]);

  const source = sources[0] ?? null;
  const task = tasks[0] ?? null;
  const conversation = conversations[0] ?? null;

  const rows = [
    source && {
      key: 'source',
      label: 'Last material',
      title: source.title,
      href: `/courses/${source.subject_id}?source=${source.id}`,
    },
    task && {
      key: 'task',
      label: 'Last tasks',
      // The type, never the table's word for it.
      title: TASK_TITLES[task.format] ?? 'Tasks',
      href: '/tasks',
    },
    conversation && {
      key: 'conversation',
      label: 'Last conversation',
      title: conversation.title ?? 'Untitled',
      href: `/dashboard?conversation=${conversation.id}`,
    },
  ].filter(Boolean);

  return (
    <Panel
      title="Recently"
      action={
        rows.length === 0 ? (
          <Link href="/courses" className={actionClass}>
            Add material
          </Link>
        ) : undefined
      }
      empty={
        rows.length === 0
          ? 'Nothing has happened yet. Add a page of notes and it will be the first thing here.'
          : undefined
      }
    >
      <ul className="motion-stagger flex flex-col">
        {rows.map((row) => (
          <li key={row.key} className="border-b border-rule last:border-b-0">
            <Link href={row.href} className={rowClass}>
              <span className="font-mono text-caption uppercase text-ink-muted">
                {row.label}
              </span>
              <span className="text-body-s">{row.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const TASK_TITLES = {
  flashcard: 'Flashcards',
  cloze: 'Cloze',
  multiple_choice: 'Multiple choice',
  open_question: 'Open questions',
};

/* --- Streak ------------------------------------------------------------- */

/**
 * How many days in a row you have shown up, in a real number.
 *
 * `README.md` bans a progress bar and a percentage everywhere else in
 * the product, on the grounds that mastery has no meaningful "how far along"
 * to report. A streak is a different kind of number: it is not a fraction of
 * anything, it is a count of days, and it is exactly the kind of fact this
 * document keeps out of *mastery* without meaning to keep it out of
 * *motivation*. This panel and Exam on the course page are where that
 * distinction is drawn — the mark stays the only way progress is shown, the
 * streak stays the only place a bare count is.
 */
export async function StreakPanel() {
  const supabase = await createClient();
  const { days, milestone } = await streakFor(supabase);

  if (days === 0) {
    return (
      <Panel
        title="Streak"
        action={
          <Link href="/tasks/due" className={actionClass}>
            Start a round
          </Link>
        }
      >
        <p className="max-w-measure text-body-s text-ink-muted">
          No streak yet. Review something today to start one.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Streak">
      <p className="font-display text-heading font-semibold">
        <span
          aria-hidden="true"
          className="motion-count"
          data-count=""
          style={{ '--motion-count-value': days }}
        />
        <span aria-hidden="true"> {days === 1 ? 'day' : 'days'} streak</span>
        <span className="sr-only">{plural(days, 'day')} streak</span>
      </p>
      {milestone ? (
        <p className="font-mono text-caption uppercase text-ink-muted">
          {milestone}-day milestone reached
        </p>
      ) : (
        <p className="font-mono text-caption uppercase text-ink-muted">Keep it going</p>
      )}
    </Panel>
  );
}

/* --- This week -------------------------------------------------------- */

/**
 * Reviews per day, as hairlines.
 *
 * A frequency histogram, not a progress bar: there is no whole for it to be a
 * fraction of. No percentage and no streak — how often you turned up is a
 * fact, a streak is a judgement, and a judgement is something to keep happy.
 */
export async function WeekPanel() {
  const supabase = await createClient();
  const days = await reviewsByDay(supabase, { days: RECENT_WINDOW_DAYS });

  return (
    <Panel
      title="This week"
      action={
        <Link href="/analytics" className={actionClass}>
          History
        </Link>
      }
    >
      <DayBars
        label="Reviews per day"
        days={days.map((day) => ({ date: day.date, value: day.reviews }))}
        unit="review"
      />
    </Panel>
  );
}

/* --- Effort ----------------------------------------------------------- */

/**
 * What the agent cost, on the page the learner passes daily.
 *
 * The agent acts on its own and there is deliberately no spending cap, so
 * this panel is the whole of the restraint: not a limit, but the number, in
 * front of you, every day, split by whether you asked for it.
 */
export async function EffortPanel() {
  const supabase = await createClient();
  const days = await effortByDay(supabase, { days: RECENT_WINDOW_DAYS });

  return (
    <Panel
      title="Effort"
      wide
      action={
        <Link href="/analytics" className={actionClass}>
          By cause
        </Link>
      }
    >
      <Effort days={days} />
    </Panel>
  );
}
