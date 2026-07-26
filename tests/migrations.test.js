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

// 007 widens read access on the material a course is made of. `reviews`,
// `conversations`, `messages`, `agent_runs` and `agent_actions` stay owner-
// only end to end — a share or a public flag never reaches personal review
// history or the agent's transcript.
const SHARED_READ_TABLES = ['subjects', 'sources', 'sections', 'concepts', 'artefacts']

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
      'subject_shares',
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

  it('gives subjects a public flag that defaults closed', () => {
    expect(all).toMatch(
      /alter table public\.subjects\s+add column if not exists is_public boolean not null default false/,
    )
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
        const policy = new RegExp(`on public\\.${table} for ${command}\\b`)
        expect(all, `${table}.${command}`).toMatch(policy)
      }
    }
  })

  it('scopes insert, update and delete to the owning user on every table', () => {
    // Sharing and the public library only ever widen `select`. Proving this
    // holds for every table, including the two new sharing surfaces, is what
    // stands between "read-only by design" and "read-only by accident".
    for (const table of tables) {
      for (const command of ['insert', 'update', 'delete']) {
        const policies = policiesFor(table, command)
        expect(policies, `${table}.${command}`).toHaveLength(1)
        expect(policies[0], `${table}.${command}`).toContain('to authenticated')
        expect(policies[0], `${table}.${command}`).toContain('(select auth.uid()) = user_id')
      }
    }
  })

  it('gives every update policy both using and with check', () => {
    for (const table of tables) {
      const [policy] = policiesFor(table, 'update')
      expect(policy, table).toMatch(/using \(\(select auth\.uid\(\)\) = user_id\)/)
      expect(policy, table).toMatch(/with check \(\(select auth\.uid\(\)\) = user_id\)/)
    }
  })

  it('scopes every non-shared table to exactly one owner-only select policy', () => {
    for (const table of tables.filter((t) => !SHARED_READ_TABLES.includes(t))) {
      const policies = policiesFor(table, 'select')
      expect(policies, table).toHaveLength(1)
      expect(policies[0], table).toContain('to authenticated')
      expect(policies[0], table).toContain('(select auth.uid()) = user_id')
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

describe('subject_shares', () => {
  it('names the sharer and the recipient as two different columns', () => {
    const body = tableBody('subject_shares')
    expect(body).toMatch(/shared_with_user_id uuid not null references auth\.users/)
    expect(body).toContain('subject_shares_not_self')
    expect(body).toMatch(/unique \(subject_id, shared_with_user_id\)/)
  })

  it('is read-only: access_level only ever means view', () => {
    const body = tableBody('subject_shares')
    expect(body).toMatch(/access_level text not null default 'view' check \(access_level in \('view'\)\)/)
  })

  it('lets the owner see and manage a share, and the recipient see and leave it', () => {
    const [select] = policiesFor('subject_shares', 'select')
    const [del] = policiesFor('subject_shares', 'delete')

    for (const policy of [select, del]) {
      expect(policy).toContain('(select auth.uid()) = user_id')
      expect(policy).toContain('(select auth.uid()) = shared_with_user_id')
    }
  })

  it('lets only the subject owner create a share, and only for a subject they own', () => {
    const [insert] = policiesFor('subject_shares', 'insert')

    expect(insert).toContain('(select auth.uid()) = user_id')
    expect(insert).toMatch(/exists \(\s*select 1 from public\.subjects s/)
    expect(insert).toContain('s.user_id = (select auth.uid())')
  })

  it('lets only the owner change an existing share', () => {
    const [update] = policiesFor('subject_shares', 'update')

    expect(update).not.toContain('shared_with_user_id')
  })
})

describe('widened read access for sharing and the public library', () => {
  it('leaves the original owner select policy on every shared-read table untouched', () => {
    for (const table of SHARED_READ_TABLES) {
      const owner = policiesFor(table, 'select').find(
        (policy) => !policy.includes('subject_shares') && !policy.includes('is_public'),
      )
      expect(owner, table).toBeDefined()
      expect(owner).toContain('to authenticated')
      expect(owner).toContain('(select auth.uid()) = user_id')
    }
  })

  it('adds exactly one share-scoped select policy per shared-read table', () => {
    for (const table of SHARED_READ_TABLES) {
      const shared = policiesFor(table, 'select').filter((policy) =>
        policy.includes('subject_shares'),
      )
      expect(shared, table).toHaveLength(1)
      expect(shared[0], table).toContain('to authenticated')
      expect(shared[0], table).toContain('shared_with_user_id = (select auth.uid())')
    }
  })

  it('adds exactly one public select policy per shared-read table, open to anon', () => {
    for (const table of SHARED_READ_TABLES) {
      const pub = policiesFor(table, 'select').filter((policy) => policy.includes('is_public'))
      expect(pub, table).toHaveLength(1)
      expect(pub[0], table).toContain('to anon, authenticated')
    }
  })

  it('never widens insert, update or delete on a shared-read table', () => {
    for (const table of SHARED_READ_TABLES) {
      for (const command of ['insert', 'update', 'delete']) {
        expect(policiesFor(table, command), `${table}.${command}`).toHaveLength(1)
      }
    }
  })

  it('reaches sections through sources, the one table with no subject_id of its own', () => {
    const [shared] = policiesFor('sections', 'select').filter((policy) =>
      policy.includes('subject_shares'),
    )
    const [pub] = policiesFor('sections', 'select').filter((policy) => policy.includes('is_public'))

    expect(shared).toMatch(/join public\.subject_shares sh on sh\.subject_id = src\.subject_id/)
    expect(pub).toMatch(/join public\.subjects s on s\.id = src\.subject_id/)
  })

  it('opens the anon role to exactly these five policies and nowhere else', () => {
    const anonPolicies = [...all.matchAll(/create policy[^;]*to anon, authenticated[^;]*;/g)]
    expect(anonPolicies).toHaveLength(SHARED_READ_TABLES.length)
  })

  it('never grants anon anything on the tables sharing does not touch', () => {
    const personalTables = tables.filter(
      (table) => !SHARED_READ_TABLES.includes(table) && table !== 'subject_shares',
    )
    for (const table of personalTables) {
      for (const command of ['select', 'insert', 'update', 'delete']) {
        for (const policy of policiesFor(table, command)) {
          expect(policy, `${table}.${command}`).not.toContain('anon')
        }
      }
    }
    // subject_shares itself is never anon-reachable either — a share is
    // between two named accounts, never a public artefact.
    for (const command of ['select', 'insert', 'update', 'delete']) {
      for (const policy of policiesFor('subject_shares', command)) {
        expect(policy, `subject_shares.${command}`).not.toContain('anon')
      }
    }
  })
})

describe('the definer functions stay narrow', () => {
  it('does not widen reviews RLS to compute the leaderboard', () => {
    // The leaderboard's cross-user read happens inside a security definer
    // function, never through a widened policy. This is the assertion that
    // would fail first if someone "simplified" the leaderboard by opening
    // `reviews` up to shared-course members instead.
    for (const command of ['select', 'insert', 'update', 'delete']) {
      const policies = policiesFor('reviews', command)
      expect(policies).toHaveLength(1)
      expect(policies[0]).not.toContain('subject_shares')
    }
  })

  it('defines share_subject_by_email as a narrow, checked security definer function', () => {
    const body = functionBody('share_subject_by_email')
    expect(body).toContain('security definer')
    expect(body).toContain("set search_path = ''")
    expect(body).toMatch(/only the course owner can share it/i)
    expect(all).toContain('revoke all on function public.share_subject_by_email(uuid, text) from public')
    expect(all).toContain(
      'grant execute on function public.share_subject_by_email(uuid, text) to authenticated',
    )
  })

  it('defines subject_leaderboard as a security definer function gated on membership', () => {
    const body = functionBody('subject_leaderboard')
    expect(body).toContain('security definer')
    expect(body).toContain("set search_path = ''")
    expect(body).toMatch(/where exists \(select 1 from membership\)/)
    expect(all).toContain('revoke all on function public.subject_leaderboard(uuid) from public')
    expect(all).toContain(
      'grant execute on function public.subject_leaderboard(uuid) to authenticated',
    )
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

/** The policies for one table and one command. */
function policiesFor(table, command) {
  const onClause = `on public.${table} for ${command}`
  return allPolicies().filter((policy) => policy.includes(onClause))
}

/** The `create table` block for one table, without the rest of the file. */
function tableBody(table) {
  const start = all.indexOf(`create table if not exists public.${table}`)
  return all.slice(start, all.indexOf('\n);', start))
}

/** The `create or replace function` block for one function, up to its `$$;`. */
function functionBody(name) {
  const start = all.indexOf(`create or replace function public.${name}`)
  const end = all.indexOf('$$;', start)
  return all.slice(start, end + 3)
}
