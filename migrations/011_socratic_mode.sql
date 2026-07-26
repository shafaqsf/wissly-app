-- 011_socratic_mode.sql
--
-- Socratic tutor mode joins chat and agent as a third value `mode` may take.
-- It answers with guiding questions instead of answers, grounded in the same
-- read-only tools as chat, and holds nothing that writes — see the Tutor role
-- in src/lib/agent/agents.js and TOOLS_BY_ROLE there.
--
-- The three tables below are the three 005 constrained to ('chat', 'agent').
-- Widening a check constraint changes no row and needs no backfill; the
-- constraint is dropped and recreated because Postgres has no
-- `alter constraint ... add value`, unlike an enum type. Row level security
-- is untouched — these are the same columns on the same tables, still covered
-- by the policies 005 already wrote.

alter table public.conversations drop constraint if exists conversations_mode_check;
alter table public.conversations add constraint conversations_mode_check
  check (mode in ('chat', 'agent', 'socratic'));

alter table public.messages drop constraint if exists messages_mode_check;
alter table public.messages add constraint messages_mode_check
  check (mode in ('chat', 'agent', 'socratic'));

alter table public.agent_runs drop constraint if exists agent_runs_mode_check;
alter table public.agent_runs add constraint agent_runs_mode_check
  check (mode in ('chat', 'agent', 'socratic'));
