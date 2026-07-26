-- 007_concept_links.sql
--
-- "See also": a concept in one course pointed at a concept in another, with
-- the one-sentence reason an agent judged them related. This is also the
-- edge table the concept map draws when a course has explicit links —
-- see docs/superpowers/specs (concept graph) and `src/lib/data/concept-graph.js`.
--
-- Undirected, stored once. A link between two concepts is the same fact
-- whichever one you looked at first, so it is written as one row rather than
-- two mirrored ones — a caller reading "see also" for a concept asks with
-- `concept_id.eq.X,related_concept_id.eq.X` instead. The unique index below
-- normalises the pair with `least`/`greatest` so the same two concepts can
-- never be linked twice, whichever order they arrived in.
--
-- Ownership follows every other table in this schema, not a join through
-- `concepts`: `user_id` is denormalised onto the row directly (see 005's
-- note on `agent_actions` for why — a policy that joins runs a subquery per
-- row, one that reads a column is an index lookup) and it is the learner who
-- owns both ends, since a link can only ever be made between two of their
-- own concepts.

create table if not exists public.concept_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  related_concept_id uuid not null references public.concepts (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint concept_links_distinct check (concept_id <> related_concept_id)
);

-- One row per unordered pair, whichever order the two ids were written in.
create unique index if not exists concept_links_pair_idx
  on public.concept_links (
    least(concept_id, related_concept_id),
    greatest(concept_id, related_concept_id)
  );

create index if not exists concept_links_user_id_idx on public.concept_links (user_id);
create index if not exists concept_links_concept_id_idx on public.concept_links (concept_id);
create index if not exists concept_links_related_concept_id_idx
  on public.concept_links (related_concept_id);

alter table public.concept_links enable row level security;

create policy "Concept links are selectable by their owner"
  on public.concept_links for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Concept links are insertable by their owner"
  on public.concept_links for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- No update policy: a link is a judgement made once. A stale or wrong one is
-- deleted and regenerated rather than edited in place, so there is nothing
-- for an UPDATE to do — and an UPDATE policy with no SELECT policy behind it
-- would silently affect zero rows anyway, which is the trap this avoids.

create policy "Concept links are deletable by their owner"
  on public.concept_links for delete
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.concept_links is
  'An agent-judged "see also" pair between two of the learner''s own concepts, '
  'undirected and stored once per pair. Feeds the "See also" list and, when a '
  'course has any, the concept map''s edges.';
