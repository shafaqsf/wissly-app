-- 004_artefact_schedule.sql
--
-- What is due, and in what state.
--
-- `reviews` is an event log: one row per grading, never overwritten. The
-- current FSRS state of an artefact is therefore its most recent row, which
-- every scheduling query would otherwise have to rediscover with the same
-- `distinct on`. This view states it once.
--
-- Only the recall formats appear. A summary or a glossary is read, not
-- answered, so it produces no evidence and has nothing to schedule.
--
-- An artefact that has never been reviewed has no state at all. It is due
-- immediately — `next_due_at` falls back to when it was created — and its
-- FSRS columns are null, which `scheduleReview` reads as a first review.
--
-- `security_invoker = true` is not optional. Without it the view runs with
-- its owner's privileges and hands every learner every other learner's
-- queue.

create or replace view public.artefact_schedule
  with (security_invoker = true)
as
with latest as (
  select distinct on (r.artefact_id)
    r.artefact_id,
    r.reviewed_at,
    r.stability,
    r.difficulty,
    r.reps,
    r.lapses,
    r.due_at
  from public.reviews r
  order by r.artefact_id, r.reviewed_at desc, r.id desc
)
select
  a.id as artefact_id,
  a.user_id,
  a.subject_id,
  a.section_id,
  a.concept_id,
  a.format,
  a.payload,
  a.created_at,
  l.stability,
  l.difficulty,
  l.reps,
  l.lapses,
  l.due_at,
  l.reviewed_at as last_reviewed_at,
  coalesce(l.due_at, a.created_at) as next_due_at
from public.artefacts a
left join latest l on l.artefact_id = a.id
where a.format in ('flashcard', 'cloze', 'multiple_choice', 'open_question');

comment on view public.artefact_schedule is
  'One row per recall artefact with its current FSRS state, taken from its '
  'most recent review. next_due_at falls back to created_at, so an artefact '
  'that has never been reviewed is due now.';
