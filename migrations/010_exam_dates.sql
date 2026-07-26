-- 010_exam_dates.sql
--
-- A course may carry a target date: the exam it is being prepared for. The
-- countdown, the adaptive daily goal and the compressed review plan
-- (`src/lib/review/daily-goal.js`, `src/lib/review/plan.js`) all read it to
-- decide how urgently to ask for reviews between now and then. A course with
-- no exam date keeps its current behaviour — the daily goal falls back to a
-- fixed lookahead and the compressed plan has nothing to compute.
--
-- There is no new table: a course *is* a subject (`src/lib/data/courses.js`),
-- so the date lands on `public.subjects`, which already enables row level
-- security and already carries a select/insert/update/delete policy per
-- command, all predicated on `(select auth.uid()) = user_id` — see 001. A
-- policy is per table and per command, not per column, so this column is
-- covered by the existing "Subjects are updatable by their owner" policy
-- (`using` and `with check` both present) the moment it exists. This file
-- creates no new table and needs no new policy.
--
-- `date`, not `timestamptz`: an exam falls on a day, not a moment, and the
-- planning code (`compressedPlan`) only ever compares whole days.

alter table public.subjects
  add column if not exists exam_date date;

comment on column public.subjects.exam_date is
  'The date this course is being prepared for, if the learner set one. Drives '
  'the exam countdown, the adaptive daily goal and the compressed review plan. '
  'Null means no exam is set and none of the three assume one.';
