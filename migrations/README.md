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
- **Row level security is part of the migration.** A table without an
  `enable row level security` statement and at least one policy is an
  incomplete migration — the Supabase anon key is public.
- **One concern per file.** A migration that touches three unrelated tables
  should have been three migrations.
