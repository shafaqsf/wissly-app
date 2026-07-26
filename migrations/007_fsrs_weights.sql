-- 007_fsrs_weights.sql
--
-- Per-user FSRS weights, fitted from a learner's own review log.
--
-- `src/lib/review/fsrs.js` ships the published FSRS-4.5 defaults, fitted over
-- someone else's review corpus. This table holds what `src/lib/review/fit-weights.js`
-- fits from this learner's own `reviews` instead — one row per user, at most,
-- because there is exactly one schedule per learner to correct.
--
-- The scheduler stays pure: it takes a `weights` array and knows nothing about
-- where it came from. This table is the "where from" — read by
-- `src/lib/data/fsrs-weights.js` and merged in at the moment a review is
-- recorded. A learner with no row here schedules on the published defaults,
-- same as before this migration existed.

create table if not exists public.fsrs_weights (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- 17 floats, same order and meaning as DEFAULT_WEIGHTS in fsrs.js.
  weights real[] not null,
  -- How much evidence the fit was made from, and what it cost to explain
  -- that evidence — both shown next to the "recompute" action so a learner
  -- can tell a fit backed by five reviews from one backed by five hundred.
  review_count int not null default 0,
  loss real,
  fitted_at timestamptz not null default now()
);

alter table public.fsrs_weights enable row level security;

create policy "FSRS weights are selectable by their owner"
  on public.fsrs_weights for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "FSRS weights are insertable by their owner"
  on public.fsrs_weights for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "FSRS weights are updatable by their owner"
  on public.fsrs_weights for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "FSRS weights are deletable by their owner"
  on public.fsrs_weights for delete
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.fsrs_weights is
  'One fitted FSRS weight vector per learner, replacing the published '
  'defaults for that learner''s own scheduling. Absent means "use the '
  'defaults" — there is no row to backfill.';
