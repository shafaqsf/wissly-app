-- 005_conversations.sql
--
-- The agent's memory: conversations, messages, runs and the actions a run
-- took. See docs/superpowers/specs/2026-07-25-agent-runtime-design.md.
--
-- Four tables, one concern: everything the agent says, does and can undo.
--
-- The ownership predicate is the same one every table since 001 carries,
-- `(select auth.uid()) = user_id`, and it matters more here than anywhere
-- else in the schema. The agent reads uploaded PDFs and pasted text — that
-- is to say, attacker-controlled input, by design. It reaches these tables
-- through the learner's own session and never through the secret key, so a
-- prompt injection buried in a lecture handout can do no more than the
-- learner could do to their own account. These policies are that ceiling.
--
-- `user_id` is denormalised onto every child table rather than joined back
-- through `conversation_id`. A policy that joins is a policy that runs a
-- subquery per row, and one that reads a column is an index lookup.

-- --- conversations ----------------------------------------------------
-- A thread. Not "a chat" and not "an agent run" — both happen inside one,
-- and `messages.mode` records which was which.
--
-- `pinned_at` and `archived_at` are timestamps rather than booleans: the
-- pinned list needs an order, and the archive needs to know when something
-- landed in it. Null means not pinned, not archived.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text,
  mode text not null default 'chat' check (mode in ('chat', 'agent')),
  pinned_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

-- The list the bar opens with: this learner's unarchived threads, pinned
-- first, then most recently spoken to. A partial index keeps the archive
-- out of the hot path entirely.
create index if not exists conversations_user_recent_idx
  on public.conversations (user_id, pinned_at desc nulls last, last_message_at desc nulls last)
  where archived_at is null;

-- A thread may be scoped to one course, and the course view wants its
-- threads. Indexed like every other foreign key in this schema.
create index if not exists conversations_subject_id_idx
  on public.conversations (subject_id);

create index if not exists conversations_user_archived_idx
  on public.conversations (user_id, archived_at desc)
  where archived_at is not null;

alter table public.conversations enable row level security;

create policy "Conversations are selectable by their owner"
  on public.conversations for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Conversations are insertable by their owner"
  on public.conversations for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Renaming, pinning and archiving are all this one policy. `with check`
-- is not optional: without it the owner could hand a thread to someone
-- else by writing a different `user_id`.
create policy "Conversations are updatable by their owner"
  on public.conversations for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Deletion exists for the learner emptying their archive. The agent never
-- reaches it — its `delete` tool sets `archived_at`.
create policy "Conversations are deletable by their owner"
  on public.conversations for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- --- messages ---------------------------------------------------------
-- One turn. `status` is the queue: a message sent while a run is in
-- flight is written `queued` immediately and rendered immediately, so the
-- learner never waits for a text field to come back.
--
-- `anchors` holds what the answer cited — an array of
-- `{section_id, anchor}` — so the interface can render the superscript
-- numerals without re-deriving them from the prose.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  mode text check (mode in ('chat', 'agent')),
  status text not null default 'done'
    check (status in ('queued', 'running', 'done', 'stopped', 'failed')),
  anchors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx
  on public.messages (conversation_id, created_at);

create index if not exists messages_user_id_idx on public.messages (user_id);

-- Draining the queue asks one question — what is next for this thread —
-- and this is the index that answers it.
create index if not exists messages_queued_idx
  on public.messages (conversation_id, created_at)
  where status = 'queued';

alter table public.messages enable row level security;

create policy "Messages are selectable by their owner"
  on public.messages for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Messages are insertable by their owner"
  on public.messages for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Streaming appends to `content` as tokens arrive, and withdrawing a
-- queued message moves its `status`. Both are updates.
create policy "Messages are updatable by their owner"
  on public.messages for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Messages are deletable by their owner"
  on public.messages for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- --- agent_runs -------------------------------------------------------
-- One pass of the agent loop, attached to the assistant message it
-- produces. This is wissly's observability: the SDK's own tracing is built
-- for OpenAI's backend and degrades with a third-party provider, and these
-- rows are better anyway — per learner, under RLS, and durable.
--
-- `status` carries `interrupted` for a run that hit a function timeout. It
-- resumes from its last completed action rather than starting over.

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid references public.messages (id) on delete set null,
  agent text not null,
  model text,
  mode text not null check (mode in ('chat', 'agent')),
  status text not null default 'running'
    check (status in ('running', 'done', 'stopped', 'interrupted', 'failed')),
  usage jsonb,
  error text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists agent_runs_conversation_id_idx
  on public.agent_runs (conversation_id, started_at desc);

create index if not exists agent_runs_message_id_idx
  on public.agent_runs (message_id);

create index if not exists agent_runs_user_id_idx on public.agent_runs (user_id);

alter table public.agent_runs enable row level security;

create policy "Agent runs are selectable by their owner"
  on public.agent_runs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Agent runs are insertable by their owner"
  on public.agent_runs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Agent runs are updatable by their owner"
  on public.agent_runs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Agent runs are deletable by their owner"
  on public.agent_runs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- --- agent_actions ----------------------------------------------------
-- One tool call that changed something, and what it would take to put it
-- back. Agent mode acts without asking at each step, which is only
-- defensible if every act is legible afterwards and reversible.
--
-- `undo` is the inverse payload, written at the time of the action while
-- the previous state is still known: for an update, the columns as they
-- were; for an insert, the id to archive. `undone_at` stamps it once the
-- learner takes it back, so an undo cannot be applied twice.
--
-- Read-only tools are not recorded here. A row in this table means
-- something changed.

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  tool text not null,
  arguments jsonb not null default '{}'::jsonb,
  result jsonb,
  undo jsonb,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_actions_run_id_idx
  on public.agent_actions (run_id, created_at);

create index if not exists agent_actions_user_id_idx
  on public.agent_actions (user_id);

alter table public.agent_actions enable row level security;

create policy "Agent actions are selectable by their owner"
  on public.agent_actions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Agent actions are insertable by their owner"
  on public.agent_actions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Agent actions are updatable by their owner"
  on public.agent_actions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Agent actions are deletable by their owner"
  on public.agent_actions for delete
  to authenticated
  using ((select auth.uid()) = user_id);
