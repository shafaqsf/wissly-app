-- 014_notifications.sql
--
-- The notification centre: one row per thing the app decided was worth
-- telling a learner about. Today that is a review reminder — see
-- `src/lib/notifications/review-reminder.js` for the FSRS-driven decision of
-- when and what — but `kind` is free text so a future notification (a weekly
-- report landing, say) is a new value, not a new table.
--
-- `read_at` is a timestamp, not a boolean, for the same reason `pinned_at`
-- and `archived_at` are in 005 and 006: null is the absence of the state, and
-- a timestamp can order and audit what a boolean cannot.
--
-- Rows are written by the learner's own session — the dashboard layout calls
-- `ensureReviewReminder` on load, which reads and writes through the
-- learner's own Supabase client — so the ownership predicate below is not
-- ceremony: it is what stops one learner from reading or resolving another
-- learner's queue.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Every table since 001 carries a plain index on its `user_id` foreign key;
-- this is that one.
create index if not exists notifications_user_id_idx
  on public.notifications (user_id);

-- The bell asks two questions: how many are unread, and what are the most
-- recent. A partial index answers the first without scanning read history;
-- the second is the same column ordered the other way, which the plain index
-- already covers.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

-- The reminder logic asks a third question before it writes anything: when
-- did I last notify this learner about this kind of thing, and how urgent was
-- it then. Answered by the most recent row for (user_id, kind).
create index if not exists notifications_user_kind_idx
  on public.notifications (user_id, kind, created_at desc);

alter table public.notifications enable row level security;

create policy "Notifications are selectable by their owner"
  on public.notifications for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Notifications are insertable by their owner"
  on public.notifications for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- The only update the product performs is marking one, or all, read.
-- `with check` is not optional: without it a learner could reassign a row to
-- someone else while marking it read.
create policy "Notifications are updatable by their owner"
  on public.notifications for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Notifications are deletable by their owner"
  on public.notifications for delete
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.notifications is
  'In-app notifications, one row per thing surfaced to a learner. kind is '
  'free text; data carries whatever that kind needs to render or to decide '
  'when to fire again (see notifications_user_kind_idx). read_at null means '
  'unread.';
