-- 006_four_areas.sql
--
-- The schema the four areas need. See
-- docs/superpowers/specs/2026-07-25-four-areas-restructuring-design.md.
--
-- Five things, and one shape they share:
--
--   1. Soft delete. `artefacts` and `sources` gain `archived_at`, the same
--      timestamp `conversations` has carried since 005. The agent archives;
--      it never deletes. A boolean could not say when.
--   2. Provenance. `artefacts.origin` records whether the learner wrote the
--      card or the agent did, so the interface can say so without guessing.
--   3. `messages.model` — chosen per message, in the bar, so the transcript
--      can say which model answered which line.
--   4. Standing orders, and the `trigger` on a run that says whether a person
--      asked for it. `agent_runs.conversation_id` stays NOT NULL: a standing
--      order posts its report into a thread like everything else, so that all
--      of what the agent did is in one place.
--   5. Full text search: a generated `tsvector` per searchable table, a GIN
--      index on each, and one view that unions them. Searching is a reflex,
--      and a reflex must not cost a model call.
--
-- Row level security. Every new *column* lands on a table that already
-- enables RLS and already carries select/insert/update/delete policies with
-- the ownership predicate `(select auth.uid()) = user_id`. Policies are per
-- table and per command, never per column, so a new column is covered by the
-- existing policies the moment it exists — verified table by table against
-- 001 and 005 below. The one new *table*, `standing_orders`, brings its own
-- full set. The one new *view* is `security_invoker = true`, without which it
-- would run as its owner and hand every learner every other learner's rows.

-- --- artefacts: soft delete and provenance -----------------------------
-- Covered by the four artefact policies in 001, all predicated on user_id.

alter table public.artefacts
  add column if not exists archived_at timestamptz;

alter table public.artefacts
  add column if not exists origin text not null default 'manual';

-- Written as a separate statement so re-running the file after a partial
-- application does not fail on a constraint that is already there.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'artefacts_origin_check'
  ) then
    alter table public.artefacts
      add constraint artefacts_origin_check check (origin in ('manual', 'agent'));
  end if;
end
$$;

-- The task workbench asks one question over and over: what is on this shelf,
-- unarchived, of this type. A partial index keeps the archive out of it.
create index if not exists artefacts_subject_format_idx
  on public.artefacts (subject_id, format, created_at desc)
  where archived_at is null;

-- Duplicate protection reads the other direction: which sections already have
-- this format, before anything is generated.
create index if not exists artefacts_section_format_idx
  on public.artefacts (section_id, format)
  where archived_at is null;

create index if not exists artefacts_user_archived_idx
  on public.artefacts (user_id, archived_at desc)
  where archived_at is not null;

-- --- sources: soft delete ----------------------------------------------
-- Covered by the four source policies in 001, all predicated on user_id.

alter table public.sources
  add column if not exists archived_at timestamptz;

create index if not exists sources_subject_active_idx
  on public.sources (subject_id, created_at desc)
  where archived_at is null;

-- --- messages: which model answered ------------------------------------
-- Covered by the four message policies in 005, all predicated on user_id.
--
-- Free text rather than a check constraint: OpenRouter's catalogue has
-- hundreds of ids and the bar takes any of them. A constraint here would go
-- stale between one migration and the next.

alter table public.messages
  add column if not exists model text;

-- --- agent_runs: who asked ---------------------------------------------
-- Covered by the four run policies in 005, all predicated on user_id.
--
-- `conversation_id` stays NOT NULL. A standing order creates or reuses a
-- thread and posts its report there; nothing needs a run without one.

alter table public.agent_runs
  add column if not exists trigger text not null default 'user';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agent_runs_trigger_check'
  ) then
    alter table public.agent_runs
      add constraint agent_runs_trigger_check check (trigger in ('user', 'schedule'));
  end if;
end
$$;

-- --- standing_orders ---------------------------------------------------
-- An instruction the agent acts on with nobody present: "notice concepts
-- below --grain-2 and generate more", weekly. `schedule` is plain text —
-- a cron expression or a phrase the trigger understands — because the
-- scheduler is not built yet and a column shape guessed now would be wrong.
--
-- `enabled` is a boolean and not a timestamp, unlike `pinned_at` and
-- `archived_at`: there is nothing to order and nothing to date, only a
-- switch. `last_run_at` carries the date that matters.

create table if not exists public.standing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  instruction text not null,
  schedule text not null,
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists standing_orders_user_id_idx
  on public.standing_orders (user_id, created_at desc);

-- What the scheduler asks: whose orders are switched on, least recently run
-- first. The archive of switched-off orders never enters it.
create index if not exists standing_orders_due_idx
  on public.standing_orders (last_run_at nulls first)
  where enabled;

alter table public.standing_orders enable row level security;

create policy "Standing orders are selectable by their owner"
  on public.standing_orders for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Standing orders are insertable by their owner"
  on public.standing_orders for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Editing the instruction, flipping `enabled`, stamping `last_run_at`: one
-- policy. `with check` is not optional — without it the owner could hand an
-- order to someone else by writing a different `user_id`, and the agent runs
-- these with nobody watching.
create policy "Standing orders are updatable by their owner"
  on public.standing_orders for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Standing orders are deletable by their owner"
  on public.standing_orders for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- --- full text search --------------------------------------------------
-- One generated column per searchable table. Generated rather than
-- maintained by a trigger: a trigger is a second place the truth lives and a
-- way for a row updated by some future migration to fall out of the index.
--
-- The regconfig is written as a literal in every expression. `to_tsvector`
-- with an explicit configuration is immutable; the two-argument form that
-- reads `default_text_search_config` is not, and a generated column requires
-- immutability.

alter table public.sources
  add column if not exists document tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(raw_text, ''))
  ) stored;

create index if not exists sources_document_idx
  on public.sources using gin (document);

alter table public.sections
  add column if not exists document tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;

create index if not exists sections_document_idx
  on public.sections using gin (document);

alter table public.concepts
  add column if not exists document tsvector
  generated always as (
    to_tsvector('english', coalesce(term, '') || ' ' || coalesce(definition, ''))
  ) stored;

create index if not exists concepts_document_idx
  on public.concepts using gin (document);

-- The artefact's text lives inside `payload`, whose shape differs per format.
-- `jsonb_to_tsvector` with an explicit regconfig walks it and takes every
-- string leaf, which is exactly the searchable part of all six formats.
alter table public.artefacts
  add column if not exists document tsvector
  generated always as (
    jsonb_to_tsvector('english', payload, '["string"]')
  ) stored;

create index if not exists artefacts_document_idx
  on public.artefacts using gin (document);

alter table public.conversations
  add column if not exists document tsvector
  generated always as (to_tsvector('english', coalesce(title, ''))) stored;

create index if not exists conversations_document_idx
  on public.conversations using gin (document);

-- --- search_index ------------------------------------------------------
-- The one union query, stated once so that `src/lib/data/search.js` is a
-- single `from('search_index')` rather than five reads and a merge in
-- JavaScript. Ranking across five tables cannot be done client-side without
-- pulling all of them back first.
--
-- `security_invoker = true` is not optional. Without it the view runs with
-- its owner's privileges and searches everyone's library.
--
-- Archived rows are excluded here rather than by the caller: the archive is
-- reached from where the archived thing lives, never from search.

create or replace view public.search_index
  with (security_invoker = true)
as
select
  'source'::text as kind,
  s.id,
  s.user_id,
  s.subject_id,
  null::uuid as parent_id,
  coalesce(nullif(s.title, ''), 'Untitled') as title,
  left(coalesce(s.raw_text, ''), 200) as snippet,
  s.created_at,
  s.document
from public.sources s
where s.archived_at is null

union all

select
  'section'::text,
  sec.id,
  sec.user_id,
  src.subject_id,
  sec.source_id,
  coalesce(nullif(src.title, ''), 'Untitled') || ' · ' || sec.ordinal::text,
  left(sec.content, 200),
  sec.created_at,
  sec.document
from public.sections sec
join public.sources src on src.id = sec.source_id
where src.archived_at is null

union all

select
  'concept'::text,
  c.id,
  c.user_id,
  c.subject_id,
  c.section_id,
  c.term,
  left(coalesce(c.definition, ''), 200),
  c.created_at,
  c.document
from public.concepts c

union all

select
  'artefact'::text,
  a.id,
  a.user_id,
  a.subject_id,
  a.section_id,
  a.format,
  left(a.payload::text, 200),
  a.created_at,
  a.document
from public.artefacts a
where a.archived_at is null

union all

select
  'conversation'::text,
  conv.id,
  conv.user_id,
  conv.subject_id,
  null::uuid,
  coalesce(nullif(conv.title, ''), 'Untitled'),
  '',
  conv.created_at,
  conv.document
from public.conversations conv
where conv.archived_at is null;

comment on view public.search_index is
  'One row per searchable thing — source, section, concept, artefact, '
  'conversation — with the tsvector its own table generates. '
  'security_invoker = true, so each branch is filtered by its base table''s '
  'row level security. Archived rows are not searchable.';
