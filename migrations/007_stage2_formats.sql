-- 007_stage2_formats.sql
--
-- The Stage 2 and 3 formats: comparison_table (understanding, read rather
-- than answered), ordering and practice_exam (recall, answered and
-- scheduled). See src/lib/agent/formats.js for the payload schema of each,
-- and docs/superpowers/specs/2026-07-24-wissly-feature-set-design.md for why
-- comparison_table is grouped with summary and glossary rather than with the
-- recall formats.
--
-- No new RLS. Every format value is checked by `artefacts_format_check`
-- alone; the four ownership policies from 001 are predicated on `user_id`,
-- not on `format`, so a new format value is covered by them the moment the
-- constraint allows it. The `artefact_schedule` view already carries
-- `security_invoker = true`, so widening its `where` clause inherits the
-- same guarantee rather than needing a new one.

-- --- artefacts: widen the format catalogue -----------------------------
-- The check constraint from 001 was declared inline, without a name, so
-- Postgres gave it the default name for a single check constraint on this
-- column: `artefacts_format_check`. Named explicitly here so a later
-- migration can find and replace it without guessing again.

alter table public.artefacts drop constraint if exists artefacts_format_check;

alter table public.artefacts
  add constraint artefacts_format_check check (
    format in (
      'summary',
      'glossary',
      'flashcard',
      'cloze',
      'multiple_choice',
      'open_question',
      'comparison_table',
      'ordering',
      'practice_exam'
    )
  );

-- --- artefact_schedule: ordering and practice_exam are answered --------
-- comparison_table stays out, for the same reason summary and glossary do:
-- it is read, not answered, so it produces no evidence and has nothing to
-- schedule. Completing a practice exam is itself an event FSRS can
-- schedule, independent of the schedules its referenced tasks already keep
-- on their own — see the note on the practice_exam schema.

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
where a.format in (
  'flashcard', 'cloze', 'multiple_choice', 'open_question', 'ordering', 'practice_exam'
);

comment on view public.artefact_schedule is
  'One row per recall artefact with its current FSRS state, taken from its '
  'most recent review. next_due_at falls back to created_at, so an artefact '
  'that has never been reviewed is due now.';
