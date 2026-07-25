-- 006_four_areas.sql
--
-- The schema the four areas need. See
-- docs/superpowers/specs/2026-07-25-four-areas-restructuring-design.md.
--
-- Four things, and one shape they share:
--
--   1. Soft delete. `artefacts` and `sources` gain `archived_at`, the same
--      timestamp `conversations` has carried since 005. The agent archives;
--      it never deletes. A boolean could not say when.
--   2. Provenance. `artefacts.origin` records whether the learner wrote the
--      card or the agent did, so the interface can say so without guessing.
--   3. `messages.model` — chosen per message, in the bar, so the transcript
--      can say which model answered which line.
--   4. Full text search: a generated `tsvector` per searchable table, a GIN
--      index on each, and one view that unions them. Searching is a reflex,
--      and a reflex must not cost a model call.
--
-- Row level security. Every new *column* lands on a table that already
-- enables RLS and already carries select/insert/update/delete policies with
-- the ownership predicate `(select auth.uid()) = user_id`. Policies are per
-- table and per command, never per column, so a new column is covered by the
-- existing policies the moment it exists — verified table by table against
-- 001 and 005 below. This file creates no new table. The one new *view* is
-- `security_invoker = true`, without which it would run as its owner and hand
-- every learner every other learner's rows.

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
