-- 001_initial_schema.sql
--
-- The knowledge base: subjects, sources, sections, concepts, artefacts.
-- Reviews live in 002; concept mastery in 003.
--
-- Every table carries `user_id` and is owned by exactly one person. The
-- publishable key reaches the browser, so row level security is the only
-- thing between a stranger and these rows: each table enables RLS and
-- carries one policy per command, all with the same ownership predicate
-- `(select auth.uid()) = user_id`. The `select` wrapper lets Postgres
-- evaluate `auth.uid()` once per statement rather than once per row.

-- --- subjects ---------------------------------------------------------
-- The top-level unit of organisation. Everything else hangs off one.

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create index if not exists subjects_user_id_idx on public.subjects (user_id);

alter table public.subjects enable row level security;

create policy "Subjects are selectable by their owner"
  on public.subjects for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Subjects are insertable by their owner"
  on public.subjects for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Subjects are updatable by their owner"
  on public.subjects for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Subjects are deletable by their owner"
  on public.subjects for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- --- sources ----------------------------------------------------------
-- What the learner uploaded. Stage 1 accepts pasted text and PDF.

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  kind text not null check (kind in ('text', 'pdf')),
  title text,
  raw_text text,
  created_at timestamptz not null default now()
);

create index if not exists sources_user_id_idx on public.sources (user_id);
create index if not exists sources_subject_id_idx on public.sources (subject_id);

alter table public.sources enable row level security;

create policy "Sources are selectable by their owner"
  on public.sources for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Sources are insertable by their owner"
  on public.sources for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Sources are updatable by their owner"
  on public.sources for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Sources are deletable by their owner"
  on public.sources for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- --- sections ---------------------------------------------------------
-- A source cut into ordered pieces, each keeping the anchor that points
-- back at the original: {"page": 4} today, slide or timestamp later.

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid not null references public.sources (id) on delete cascade,
  ordinal int not null,
  content text not null,
  anchor jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sections_user_id_idx on public.sections (user_id);
create index if not exists sections_source_id_idx on public.sections (source_id);

alter table public.sections enable row level security;

create policy "Sections are selectable by their owner"
  on public.sections for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Sections are insertable by their owner"
  on public.sections for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Sections are updatable by their owner"
  on public.sections for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Sections are deletable by their owner"
  on public.sections for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- --- concepts ---------------------------------------------------------
-- What the subject is actually made of. Mastery is measured per concept.

create table if not exists public.concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  term text not null,
  definition text,
  section_id uuid references public.sections (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists concepts_user_id_idx on public.concepts (user_id);
create index if not exists concepts_subject_id_idx on public.concepts (subject_id);
create index if not exists concepts_section_id_idx on public.concepts (section_id);

alter table public.concepts enable row level security;

create policy "Concepts are selectable by their owner"
  on public.concepts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Concepts are insertable by their owner"
  on public.concepts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Concepts are updatable by their owner"
  on public.concepts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Concepts are deletable by their owner"
  on public.concepts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- --- artefacts --------------------------------------------------------
-- A generated study object. The format fixes the shape of `payload`;
-- the formats listed here are the stage 1 catalogue.

create table if not exists public.artefacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  section_id uuid references public.sections (id) on delete set null,
  concept_id uuid references public.concepts (id) on delete set null,
  format text not null check (
    format in (
      'summary',
      'glossary',
      'flashcard',
      'cloze',
      'multiple_choice',
      'open_question'
    )
  ),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists artefacts_user_id_idx on public.artefacts (user_id);
create index if not exists artefacts_subject_id_idx on public.artefacts (subject_id);
create index if not exists artefacts_section_id_idx on public.artefacts (section_id);
create index if not exists artefacts_concept_id_idx on public.artefacts (concept_id);

alter table public.artefacts enable row level security;

create policy "Artefacts are selectable by their owner"
  on public.artefacts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Artefacts are insertable by their owner"
  on public.artefacts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Artefacts are updatable by their owner"
  on public.artefacts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Artefacts are deletable by their owner"
  on public.artefacts for delete
  to authenticated
  using ((select auth.uid()) = user_id);
