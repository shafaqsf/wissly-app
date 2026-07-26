-- 008_generated_sources.sql
--
-- Autonomous course-build from a stated goal (see
-- src/lib/agent/course-from-goal.js) drafts sections from the model's own
-- knowledge rather than cutting them from something the learner uploaded.
-- `sources.generated` says so at the source level, alongside the
-- `{"generated": true}` every one of its sections already carries in its own
-- `anchor` — the anchor is what the citation UI actually reads, so the column
-- here is the shelf-level signal the course page and the library read to
-- warn before the learner ever opens one.
--
-- The product's citation guarantee is that a claim can be traced to the page
-- it came from. Generated material has no such page, and the one dishonest
-- thing this migration could do is let it sit unmarked next to material that
-- does — indistinguishable is the failure, not merely undisclosed.
--
-- Covered by the four source policies already in 001, all predicated on
-- user_id — a new column on an existing table needs no new policy.

alter table public.sources
  add column if not exists generated boolean not null default false;

-- The course shelf and the library both want to say so without a second
-- query per source.
create index if not exists sources_generated_idx
  on public.sources (subject_id, generated)
  where generated is true;
