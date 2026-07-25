// @vitest-environment node
//
// There is no database in CI, so these tests read the migration files as
// text. They cannot prove the SQL runs; they can prove the rules in
// migrations/README.md were not forgotten — which is the failure mode that
// actually costs data.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = join(process.cwd(), 'migrations')
const files = readdirSync(dir).filter((name) => name.endsWith('.sql'))
const sql = files.map((name) => [name, readFileSync(join(dir, name), 'utf8')])
const all = sql.map(([, body]) => body).join('\n')

/** Table names created across every migration. */
const tables = [...all.matchAll(/create table if not exists public\.(\w+)/g)].map(
  (match) => match[1],
)

describe('migration files', () => {
  it('are numbered NNN_snake_case.sql', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const name of files) {
      expect(name).toMatch(/^\d{3}_[a-z0-9_]+\.sql$/)
    }
  })

  it('are applied in ascending, gap-free order', () => {
    const numbers = files.map((name) => Number(name.slice(0, 3))).sort((a, b) => a - b)
    expect(numbers).toEqual(numbers.map((_, index) => index + 1))
  })
})

describe('the schema', () => {
  it('creates every table the feature set needs', () => {
    expect(tables.sort()).toEqual([
      'agent_actions',
      'agent_runs',
      'artefacts',
      'concepts',
      'conversations',
      'messages',
      'reviews',
      'sections',
      'sources',
      'standing_orders',
      'subjects',
    ])
  })

  it('gives every table a user_id that references auth.users', () => {
    for (const table of tables) {
      const body = tableBody(table)
      expect(body, table).toMatch(
        /user_id uuid not null references auth\.users \(id\) on delete cascade/,
      )
    }
  })
})

describe('row level security', () => {
  it('is enabled on every table', () => {
    for (const table of tables) {
      expect(all, table).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('gives every table a policy for all four commands', () => {
    for (const table of tables) {
      for (const command of ['select', 'insert', 'update', 'delete']) {
        const policy = new RegExp(
          `on public\\.${table} for ${command}\\b`,
        )
        expect(all, `${table}.${command}`).toMatch(policy)
      }
    }
  })

  it('scopes every policy to the owning user', () => {
    const policies = allPolicies()
    expect(policies.length).toBe(tables.length * 4)
    for (const policy of policies) {
      expect(policy).toContain('to authenticated')
      expect(policy).toContain('(select auth.uid()) = user_id')
    }
  })

  it('gives every update policy both using and with check', () => {
    const updates = allPolicies().filter((policy) => / for update\b/.test(policy))
    expect(updates.length).toBe(tables.length)
    for (const policy of updates) {
      expect(policy).toMatch(/using \(\(select auth\.uid\(\)\) = user_id\)/)
      expect(policy).toMatch(/with check \(\(select auth\.uid\(\)\) = user_id\)/)
    }
  })

  it('creates every view with security_invoker', () => {
    const views = [...all.matchAll(/create (?:or replace )?view public\.(\w+)([\s\S]*?)as\b/g)]
    expect(views.length).toBeGreaterThan(0)
    for (const [, name, options] of views) {
      expect(options, name).toContain('security_invoker = true')
    }
  })
})

describe('indexes', () => {
  it('covers every foreign key', () => {
    const keys = [...all.matchAll(/^\s+(\w+) uuid[^\n]*references public\./gm)].map(
      (m) => m[1],
    )
    expect(keys.length).toBeGreaterThan(0)
    for (const [table, body] of sql) {
      for (const column of body.match(/^\s+\w+ uuid[^\n]*references/gm) ?? []) {
        const name = column.trim().split(' ')[0]
        if (name === 'id') continue
        expect(body, `${table}: ${name}`).toMatch(
          new RegExp(`create index if not exists \\w+_${name}_idx`),
        )
      }
    }
  })

  it('covers the review scheduling query', () => {
    expect(all).toMatch(
      /create index if not exists reviews_user_id_due_at_idx\s+on public\.reviews \(user_id, due_at\)/,
    )
  })
})

/** Every `create policy` statement, one string each. Policies hold no `;`. */
function allPolicies() {
  return [...all.matchAll(/create policy[^;]*;/g)].map((match) => match[0])
}

/** The `create table` block for one table, without the rest of the file. */
function tableBody(table) {
  const start = all.indexOf(`create table if not exists public.${table}`)
  return all.slice(start, all.indexOf('\n);', start))
}
