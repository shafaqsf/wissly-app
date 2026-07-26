-- 015_collaboration.sql
--
-- The first cross-user-visible rows in this schema. Three features, one
-- shared risk: every predicate below decides whether a stranger can read
-- another learner's material, so each one is written out in full rather than
-- folded into a helper that would hide what it actually checks.
--
--   1. Sharing.  A course owner grants another *named* learner read access
--      to a subject. `subject_shares` records who shared what with whom.
--      Read-only, on purpose: propose-edits access is a second surface (who
--      may write, how a proposal is reviewed, what happens to a rejected
--      one) that this batch does not need to ship collaboration. Widening
--      read access only, later, to write access is additive; the reverse is
--      a security incident.
--
--   2. Leaderboards.  Ranking members of a shared course by reviews
--      completed this week requires reading *other people's* `reviews`
--      rows. That table's RLS is not widened for it — a learner's review
--      history is not course material, and sharing a course must not leak
--      it wholesale. `subject_leaderboard` is a `security definer` function
--      instead: a single, narrow, audited crossing that returns aggregate
--      counts only, and only for people who already share the same course
--      as the caller.
--
--   3. The public library.  `subjects.is_public` plus a `select` policy open
--      to `anon` as well as `authenticated` — the one place in this schema
--      that role appears, because a library has to be browsable signed out.
--      Importing is a plain client-side copy (read the public rows under the
--      new policy, insert them again under the importer's own `user_id`), so
--      it needs no new table and no elevated function.
--
-- What every widened `select` policy below shares: it is *additive*. The
-- original owner-only policy from 001/002/005 is left exactly as it was, and
-- a second (for a share) or third (for public visibility) permissive policy
-- is added beside it — Postgres `or`s permissive policies for the same
-- command together. `insert`, `update` and `delete` are never widened here;
-- a share or a public flag only ever grants reading.

-- --- subjects: visibility ------------------------------------------------

alter table public.subjects
  add column if not exists is_public boolean not null default false;

-- --- subject_shares -------------------------------------------------------
-- One row: this owner gave this other learner read access to this subject.
--
-- `user_id` is the sharer (the subject's owner at the time of the grant),
-- kept under the name every other table in this schema uses for "the person
-- who owns this row" so the generic checks in tests/migrations.test.js keep
-- meaning what they say. `shared_with_user_id` is the second party a share
-- inherently has, and is never `user_id` — a policy in this file that
-- confused the two would grant the wrong person access.

create table if not exists public.subject_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  shared_with_user_id uuid not null references auth.users (id) on delete cascade,
  -- Denormalised from `auth.users.email` at the moment `share_subject_by_email`
  -- inserts the row. `subject_shares` carries no policy that could read
  -- `auth.users` itself, so without a copy the owner who typed this address
  -- could not be shown it again — the row would say "shared with
  -- <some uuid>" forever. The owner already knows the address; this is not
  -- new information reaching them, only the same information surviving past
  -- the moment they typed it.
  invitee_email text not null,
  access_level text not null default 'view' check (access_level in ('view')),
  created_at timestamptz not null default now(),
  constraint subject_shares_not_self check (user_id <> shared_with_user_id),
  unique (subject_id, shared_with_user_id)
);

create index if not exists subject_shares_user_id_idx
  on public.subject_shares (user_id);
create index if not exists subject_shares_subject_id_idx
  on public.subject_shares (subject_id);
create index if not exists subject_shares_shared_with_user_id_idx
  on public.subject_shares (shared_with_user_id);

alter table public.subject_shares enable row level security;

-- Both parties to a share can see it: the owner to manage who has access,
-- the recipient to know what has been shared with them.
create policy "Subject shares are selectable by owner or recipient"
  on public.subject_shares for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = shared_with_user_id
  );

-- Sharing requires owning the subject. Without the `exists` clause a learner
-- could write `user_id = auth.uid()` beside a `subject_id` they do not own —
-- the column alone is not the check, the row it points at is.
create policy "Subject shares are insertable by the subject owner"
  on public.subject_shares for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.subjects s
      where s.id = subject_id and s.user_id = (select auth.uid())
    )
  );

-- The only thing an update can change is `access_level`, and only the owner
-- may change it — a recipient rewriting their own row to a higher level
-- would be a privilege escalation `with check` exists to stop.
create policy "Subject shares are updatable by the subject owner"
  on public.subject_shares for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Either party can end a share: the owner revoking it, or the recipient
-- leaving a course they no longer want in their list.
create policy "Subject shares are deletable by owner or recipient"
  on public.subject_shares for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = shared_with_user_id
  );

-- --- subjects: widened read access ---------------------------------------
-- The owner policy from 001 is untouched. These are additional, permissive
-- `select` policies; Postgres evaluates all of a table's permissive policies
-- for a command and grants the row if any one of them passes.

create policy "Subjects are selectable by a share"
  on public.subjects for select
  to authenticated
  using (
    exists (
      select 1 from public.subject_shares sh
      where sh.subject_id = subjects.id
        and sh.shared_with_user_id = (select auth.uid())
    )
  );

-- The one policy in this schema open to `anon`: a public course has to be
-- readable by a visitor who has not signed in, or `/library` cannot browse
-- signed out the way the feature is meant to.
create policy "Public subjects are selectable by anyone"
  on public.subjects for select
  to anon, authenticated
  using (is_public);

-- --- sources / concepts / artefacts: widened read access -----------------
-- All three carry `subject_id` directly, so the predicate is the same shape
-- three times over: a share on the subject, or the subject being public.

create policy "Sources are selectable by a share"
  on public.sources for select
  to authenticated
  using (
    exists (
      select 1 from public.subject_shares sh
      where sh.subject_id = sources.subject_id
        and sh.shared_with_user_id = (select auth.uid())
    )
  );

create policy "Public sources are selectable by anyone"
  on public.sources for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.subjects s
      where s.id = sources.subject_id and s.is_public
    )
  );

create policy "Concepts are selectable by a share"
  on public.concepts for select
  to authenticated
  using (
    exists (
      select 1 from public.subject_shares sh
      where sh.subject_id = concepts.subject_id
        and sh.shared_with_user_id = (select auth.uid())
    )
  );

create policy "Public concepts are selectable by anyone"
  on public.concepts for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.subjects s
      where s.id = concepts.subject_id and s.is_public
    )
  );

create policy "Artefacts are selectable by a share"
  on public.artefacts for select
  to authenticated
  using (
    exists (
      select 1 from public.subject_shares sh
      where sh.subject_id = artefacts.subject_id
        and sh.shared_with_user_id = (select auth.uid())
    )
  );

create policy "Public artefacts are selectable by anyone"
  on public.artefacts for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.subjects s
      where s.id = artefacts.subject_id and s.is_public
    )
  );

-- --- sections: widened read access ---------------------------------------
-- Sections are the one table in the shared chain with no `subject_id` of
-- their own — only `source_id`. The predicate joins through `sources` to
-- reach it, which every other policy in this file avoids; the join is
-- indexed on both ends (`sources_subject_id_idx` from 001,
-- `subject_shares_subject_id_idx` above), and this table's own row count is
-- bounded by twelve sections per source, so the cost is a lookup, not a scan.

create policy "Sections are selectable by a share"
  on public.sections for select
  to authenticated
  using (
    exists (
      select 1
      from public.sources src
      join public.subject_shares sh on sh.subject_id = src.subject_id
      where src.id = sections.source_id
        and sh.shared_with_user_id = (select auth.uid())
    )
  );

create policy "Public sections are selectable by anyone"
  on public.sections for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.sources src
      join public.subjects s on s.id = src.subject_id
      where src.id = sections.source_id and s.is_public
    )
  );

-- --- share_subject_by_email ------------------------------------------------
-- Inviting "by email" needs to turn an email address into a user id, and
-- `auth.users` is not reachable through PostgREST or any policy in `public`
-- — by design, nothing in this schema is allowed to select from it directly.
-- A `security definer` function is the one sanctioned way to cross that
-- line, and migrations/README.md is right to warn that such a function
-- bypasses RLS. It does not bypass authorization: the function re-checks
-- subject ownership by hand, the same way the `insert` policy above would
-- have, before it writes anything. `set search_path = ''` and schema-
-- qualifying every reference closes the other hole a `security definer`
-- function usually opens — a caller redefining an unqualified `subjects` in
-- their own search path to run with this function's elevated privilege.
--
-- Errors are deliberately specific ("no account uses that email") rather
-- than a generic failure. That does mean this function can be used to probe
-- whether an email has a wissly account — the same trade-off "invite a
-- collaborator by email" makes in most software, and it is bounded here to
-- learners who already own the course they are trying to share, not to
-- anyone with a browser.

create or replace function public.share_subject_by_email(
  target_subject_id uuid,
  invitee_email text
)
returns public.subject_shares
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  invitee uuid;
  invitee_actual_email text;
  result public.subject_shares;
begin
  if caller is null then
    raise exception 'Sign in to share a course.';
  end if;

  if not exists (
    select 1 from public.subjects s
    where s.id = target_subject_id and s.user_id = caller
  ) then
    raise exception 'Only the course owner can share it.';
  end if;

  select id, email into invitee, invitee_actual_email
  from auth.users
  where lower(email) = lower(trim(invitee_email))
  limit 1;

  if invitee is null then
    raise exception 'No wissly account uses that email.';
  end if;

  if invitee = caller then
    raise exception 'You already have access to your own course.';
  end if;

  insert into public.subject_shares (user_id, subject_id, shared_with_user_id, invitee_email)
  values (caller, target_subject_id, invitee, invitee_actual_email)
  on conflict (subject_id, shared_with_user_id) do update
    set access_level = excluded.access_level
  returning * into result;

  return result;
end;
$$;

revoke all on function public.share_subject_by_email(uuid, text) from public;
grant execute on function public.share_subject_by_email(uuid, text) to authenticated;

-- --- subject_leaderboard ----------------------------------------------------
-- Also `security definer`, for the reason explained at the top of this file:
-- ranking members means reading rows in `reviews` that do not belong to the
-- caller, and `reviews` RLS is not widened for it anywhere in this
-- migration. This function is the one narrow, audited crossing — it returns
-- a count per member, never a review row, and only computes anything at all
-- when the caller is themselves a member of the subject asked about.
--
-- A caller who is not a member gets an empty result, not an exception. The
-- function does not confirm or deny that `target_subject_id` exists to
-- someone outside it — the same non-answer the `is_public = false` branch of
-- the `subjects` policies above gives a stranger.
--
-- The metric is reviews logged in the last 7 days. `reviews` is the only
-- evidence this schema keeps of a learner doing anything, so it is also the
-- only thing a real, un-gamed ranking can be built from.

create or replace function public.subject_leaderboard(target_subject_id uuid)
returns table (member_id uuid, reviews_this_week bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with members as (
    select s.user_id as member_id
    from public.subjects s
    where s.id = target_subject_id
    union
    select sh.shared_with_user_id
    from public.subject_shares sh
    where sh.subject_id = target_subject_id
  ),
  membership as (
    select 1 from members where member_id = auth.uid()
  )
  select
    m.member_id,
    count(r.id) filter (
      where r.reviewed_at >= now() - interval '7 days'
    ) as reviews_this_week
  from members m
  left join public.reviews r on r.user_id = m.member_id
  where exists (select 1 from membership)
  group by m.member_id
  order by reviews_this_week desc, m.member_id;
$$;

revoke all on function public.subject_leaderboard(uuid) from public;
grant execute on function public.subject_leaderboard(uuid) to authenticated;
