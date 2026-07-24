# Migrations

Plain SQL, applied in ascending filename order. Nothing else determines order.

## Naming

```
NNN_snake_case_description.sql
```

`NNN` is a zero-padded three-digit sequence starting at `001`. Pick the next
free number; if two branches collide on the same number, the second one to
merge renumbers.

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
  - Run `supabase db advisors` before committing a migration.
- **One concern per file.** A migration that touches three unrelated tables
  should have been three migrations.
