# Migrations

Plain SQL, applied in ascending filename order. Nothing else determines order.

## Applying them

By hand, in the Supabase dashboard: **SQL Editor → New query**, paste the file,
run it. One file per query, in ascending order, and never a file that has
already been applied — these migrations are forward-only and not idempotent
beyond the `if not exists` guards they carry themselves.

There is no migration runner and no direct Postgres connection string in the
environment. The publishable and secret keys speak to PostgREST, which cannot
execute DDL, so nothing in the application can apply a migration — by design.

The cost of applying by hand is that the database has no record of what ran.
**The files in this directory are that record.** A file merged to `main` is one
that has been applied; if you merge one without running it, nothing will tell
you.

After running a migration, open **Advisors → Security Advisor** in the
dashboard and clear anything it reports. It is the check that catches a table
left without row level security, and it is not optional.

## Naming

```
NNN_snake_case_description.sql
```

`NNN` is a zero-padded three-digit sequence starting at `001`. Pick the next
free number, counting the numbers unmerged branches have already claimed as
taken; if two branches collide on the same number, the second one to merge
renumbers.

A number is claimed when the file is written, not when it merges, so a branch
may carry a gap below its own number — those are the migrations of sibling
branches still in flight, and the gap closes when they merge. Gaps are fine;
duplicates are not, because ascending filename order is the only thing that
decides what runs when.

Free means free across every branch in flight, not just the ones already on
`main`. Two files claiming the same number apply in an order nothing defines,
so uniqueness is the rule that is enforced. A **gap** is not: a branch that
steps over a number a sibling has already claimed is doing the right thing,
and the gap closes on `main` when that sibling lands.

Free means free across every branch in flight, not just the ones already on
`main`. Two files claiming the same number apply in an order nothing defines,
so uniqueness is the rule that is enforced. A **gap** is not: a branch that
steps over a number a sibling has already claimed is doing the right thing,
and the gap closes on `main` when that sibling lands.

Free means free across every branch in flight, not just the ones already on
`main`. Two files claiming the same number apply in an order nothing defines,
so uniqueness is the rule that is enforced. A **gap** is not: a branch that
steps over a number a sibling has already claimed is doing the right thing,
and the gap closes on `main` when that sibling lands.

```
001_initial_schema.sql
002_learning_paths.sql
003_agent_runs.sql
```

## Rules

- **Migrations are append-only.** Once a file is merged to `main` it is never
  edited — correct it with a new migration instead. The one exception is a
  migration that has not left your branch yet.
- **Forward only.** No `down` files. Rolling back a schema change means
  writing the inverse migration.
- **Idempotent where cheap.** Prefer `create table if not exists`,
  `create or replace function`, `drop ... if exists`.
- **Row level security is part of the migration.** A table in an exposed
  schema without an `enable row level security` statement and at least one
  policy is an incomplete migration — the publishable key reaches the browser,
  so the policy is the only thing between a stranger and the rows.
  - `TO authenticated` checks the role, not the row. Pair it with an ownership
    predicate: `using ((select auth.uid()) = user_id)`.
  - `UPDATE` policies need both `USING` and `WITH CHECK`, or a user can
    reassign a row to someone else. An `UPDATE` without a matching `SELECT`
    policy silently affects zero rows and raises no error.
  - Views bypass RLS unless created `with (security_invoker = true)`.
  - `security definer` functions bypass RLS and, in `public`, are callable by
    everyone. Prefer `security invoker`.
  - Never put authorization data in `raw_user_meta_data` — users can edit it.
    Use `raw_app_meta_data`.
  - Check **Advisors → Security Advisor** in the dashboard after applying a
    migration, and before merging it.
- **One concern per file.** A migration that touches three unrelated tables
  should have been three migrations.
