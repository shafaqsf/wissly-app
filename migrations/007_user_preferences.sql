-- 007_user_preferences.sql
--
-- Settings needed somewhere to live. One row per learner, keyed on the id
-- itself rather than a surrogate — a preference belongs to exactly one
-- account and never needs a second row for the same one.
--
-- `default_model` is the one preference this file adds: which OpenRouter
-- model generation reaches for when nothing more specific was chosen. Free
-- text, like `messages.model` in 006 — OpenRouter's catalogue has hundreds of
-- ids, the settings page offers a curated few, and a constraint here would go
-- stale the day a fourth one is curated.

create table if not exists public.user_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  default_model text,
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

create index if not exists user_preferences_user_id_idx
  on public.user_preferences (user_id);

alter table public.user_preferences enable row level security;

-- One row per learner and the primary key is the ownership predicate, so
-- these four policies are the whole of it. `with check` on `insert` and
-- `update` matters exactly as much as everywhere else in this schema: without
-- it a learner could write a row — or move an existing one — onto someone
-- else's id.

create policy "Preferences are selectable by their owner"
  on public.user_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Preferences are insertable by their owner"
  on public.user_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Preferences are updatable by their owner"
  on public.user_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Preferences are deletable by their owner"
  on public.user_preferences for delete
  to authenticated
  using ((select auth.uid()) = user_id);
