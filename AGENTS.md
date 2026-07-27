<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# wissly

An open source agentic learning platform. Next.js 16 (App Router, JavaScript),
Tailwind CSS v4, Supabase for persistence, OpenRouter for language models,
Vitest + Testing Library for tests.

## Read `docs/` before you write anything

The documents in `docs/` are binding, not background reading. Read the ones
that touch your task **before** the first edit, and match the patterns you
find there. If your change would break a pattern, say so and get agreement
first — do not quietly diverge.

| Document | Read it before |
| --- | --- |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Any branch, commit, version bump, worktree, push or pull request |
| [`migrations/README.md`](migrations/README.md) | Any schema change |

When a document is wrong, fix the document in the same change that breaks its
rule. A pattern that lives only in someone's head is not a pattern.

## Non-negotiables

**Test-driven.** Every behaviour change starts with a failing test. Write it,
run it, confirm it fails *for the reason you expect*, then write the smallest
code that makes it pass. `npm test` before every commit.

**Row level security.** RLS is a first-class requirement, not a hardening pass
at the end. The Supabase publishable key reaches the browser, so the database
is the only thing protecting the data. A migration that creates a table in an
exposed schema without `enable row level security` and at least one policy is
incomplete and must not be committed. `TO authenticated` alone is not a
policy — it checks the role, not which rows that role may touch; pair it with
an ownership predicate. `UPDATE` policies need both `USING` and `WITH CHECK`,
and an `UPDATE` without a `SELECT` policy silently affects zero rows. Views
bypass RLS unless created `WITH (security_invoker = true)`. The secret key is
server-only, bypasses RLS entirely, and never reaches a `NEXT_PUBLIC_`
variable or a client component.

**Finish the branch yourself.** When the work is done and the suite is green,
carry out the whole sequence without asking: push, open the pull request with
a Conventional Commit title and the CHANGELOG entry in the body, squash-merge
it, pull `main` back into the main worktree, and delete the worktree and the
branch. The worktree goes in the same run that merged it, not in a later
cleanup pass — check it is clean first. Stop and leave the PR open only on red
checks, a conflict with `main`, or a decision that genuinely needs a human.

**Configuration goes straight to `main`.** Tooling, CI, dependency bumps and
docs do not get a branch or a worktree. Features do, in their own worktree
named `<type>/<description>` — no version number in a branch or worktree name.
Versions are cut on `main` at release time, and a branch never touches
`package.json` or `CHANGELOG.md`.

**No colour in the chrome.** Black ink, white paper, monochrome icons. Every
control, glyph, border and label is ink on paper. Hue exists in exactly one
place — inside a grain field — where it encodes the same state the grain
encodes and moves with it. A `--color-field-*` token outside a `.field-*`
class in `globals.css` is a bug, and a test fails on it. No status colours: no
red for errors, no green for success. There is no dark mode.

**Commit small.** One reviewable thought per commit, Conventional Commits
format, English.

## Layout

```
src/app/        Routes, layouts, pages (App Router)
src/app/*.test.jsx   Tests live beside the code they cover
migrations/     Numbered, append-only SQL
docs/           Binding conventions
```

`.jsx` for anything containing JSX, `.js` for everything else, `.mjs` for
tooling config. Vite's parser picks its grammar by extension, so JSX in a
`.js` file breaks the test runner.

## Commands

```bash
npm run dev            # development server
npm test               # full suite, once
npm run test:watch     # while working
npm run lint           # ESLint
npm run build          # production build
```

## Environment

Copy `.env.example` to `.env.local`. Secrets never land in a committed file
and never in a `NEXT_PUBLIC_` variable unless they are genuinely public.
