-- 002_reviews.sql
--
-- Spaced repetition over every recall artefact, not only flashcards.
-- One row per grading event, carrying the FSRS memory state that the
-- grading produced. `due_at` is when that artefact should come back.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  artefact_id uuid not null references public.artefacts (id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  -- FSRS grade: 1 again, 2 hard, 3 good, 4 easy.
  rating int not null check (rating between 1 and 4),
  stability real,
  difficulty real,
  due_at timestamptz,
  reps int not null default 0,
  lapses int not null default 0
);

create index if not exists reviews_user_id_idx on public.reviews (user_id);
create index if not exists reviews_artefact_id_idx on public.reviews (artefact_id);

-- The scheduling query: what is due for me, soonest first.
create index if not exists reviews_user_id_due_at_idx
  on public.reviews (user_id, due_at);

alter table public.reviews enable row level security;

create policy "Reviews are selectable by their owner"
  on public.reviews for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Reviews are insertable by their owner"
  on public.reviews for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Reviews are updatable by their owner"
  on public.reviews for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Reviews are deletable by their owner"
  on public.reviews for delete
  to authenticated
  using ((select auth.uid()) = user_id);
