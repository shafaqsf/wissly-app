# Conventions

How work moves through this repository. English everywhere: branch names,
commits, code, comments, docs.

## What needs a branch, and what does not

| Kind of change | Where |
| --- | --- |
| A feature, or a fix to one | Feature branch in its own worktree, pushed for review |
| Configuration, tooling, CI, dependency bumps, docs | Directly on `main` |

Configuration is not a feature. Adding a linter rule, bumping Next.js, or
fixing a typo in this file does not justify a branch, a worktree, or a pull
request — commit it to `main` and, if it is worth a version, release it there.

## Branch names

```
<type>/<short-description>
```

- `<type>` — `feat` `fix` `refactor` `perf` `test`
- `<short-description>` — lower case, kebab-case, two to four words

```
feat/supabase-migrations
feat/openrouter-client
fix/openrouter-retry-backoff
refactor/agent-run-store
```

**No version number in the branch name.** A branch says what it does, not what
release it thinks it will land in. Versions are decided on `main`, at release
time, from what has actually been merged — see [Versioning](#versioning).

The description carries the whole meaning now, so make it say something —
`fix/openrouter-retry-backoff`, not `fix/bug`. If the scope of the branch
changes enough that the name lies, rename it (`git branch -m`) before pushing.

## Versioning

Semantic versioning, pre-1.0:

| Change | Bump |
| --- | --- |
| New capability | minor — `0.2.0` → `0.3.0` |
| Bug fix, no behaviour added | patch — `0.3.0` → `0.3.1` |
| Breaking change | still minor, until `1.0.0` |

`1.0.0` is the point at which the public surface — the database schema, the
agent API and the env contract — is considered stable.

### Releasing

**A branch never touches `package.json` or `CHANGELOG.md`.** It does not know
which version it will end up in, and it must not guess — two branches guessing
in parallel is how the number in `package.json` stopped describing the code.

A branch hands over its changelog text in the PR body instead:

```markdown
### Added
- OpenRouter chat completion client with configurable model and retry on 429.
```

Releasing happens on `main`, on its own, whenever the merged work is worth a
version. The bump reads what has actually landed since the last tag and picks
minor or patch from the table above:

```bash
# on main, after the merges that make up the release
npm version minor -m "chore(release): %s"   # bumps package.json, commits, tags
git push --follow-tags
```

The `CHANGELOG.md` entry — assembled from the PR bodies in the release — goes
in that same `chore(release)` commit.

Because releases are cut on `main` rather than claimed up front, nothing has
to be checked or reserved before starting a branch, and two branches can never
collide over a number neither of them owns.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), imperative mood,
no trailing period:

```
feat(agent): add OpenRouter chat completion client
fix(db): scope lesson policy to the owning user
test(agent): cover retry on 429 responses
chore(deps): bump next to 16.2.11
```

Types: `feat` `fix` `refactor` `perf` `test` `docs` `chore` `ci` `build`

Scopes: `app` `db` `agent` `ui` `auth` `api` `ci` `deps` `docs`

Commit small. A commit should be one reviewable thought — a failing test and
the code that makes it pass are two commits, not one.

## Worktrees

The repository lives in `wissly-app/`. Feature worktrees are its siblings:

```
Softwareprojekte/
└── wissly/
    ├── wissly-app/                   <- main
    ├── feat-openrouter-client/       <- worktree
    └── fix-openrouter-retry/         <- worktree
```

The directory name is the branch name with `/` replaced by `-` — no version in
either.

```bash
# start
git worktree add ../feat-openrouter-client -b feat/openrouter-client
cd ../feat-openrouter-client && npm install

# finish — push, PR, squash-merge, pull, then delete this worktree.
# The full sequence is below, under "Finishing a branch".
```

A worktree lives exactly as long as its branch is unmerged. It is created
when the branch starts and deleted in the same run that merges it — see
[Finishing a branch](#finishing-a-branch-push-pr-merge-pull-delete).

Each worktree needs its own `npm install` and its own `.env.local` — neither
is tracked by git.

## Finishing a branch: push, PR, merge, pull, delete

**Finishing a branch is one uninterrupted sequence, carried out automatically —
push, open the pull request, squash-merge it, pull `main`, delete the
worktree.** No handover, no waiting for a maintainer.

```bash
# 1. push
git push -u origin feat/openrouter-client

# 2. open the PR — title is the squash commit, body carries the changelog text
gh pr create --title "feat(agent): add OpenRouter chat completion client" --body "..."

# 3. squash-merge it
gh pr merge --squash --delete-branch

# 4. pull the merged main back into the main worktree
cd ../wissly-app && git pull

# 5. the pull succeeded, so the branch is in main — remove the worktree
git worktree remove ../feat-openrouter-client
git branch -d feat/openrouter-client
git worktree prune
```

Step 5 is not optional and does not wait for a later cleanup pass. The
worktree is deleted in the same run that merged it, immediately after the
pull confirms the work is on `main` — a merged worktree left on disk is the
thing that turns into a directory nobody dares delete a month later. `git
branch -d` is the safe form on purpose: it refuses a branch that is not
merged, so a failed step 3 cannot take the work with it.

The one thing to check before step 5: the worktree must be clean. Anything
uncommitted in it was never part of the PR and would be lost. If
`git status` there is not empty, stop, say what is uncommitted, and leave the
worktree in place.

The PR title is a Conventional Commit. PRs are squash-merged, so that title
becomes the single commit on `main` — it is the changelog-facing line, not a
throwaway.

The PR body carries the changelog text for this change — no version number on
it, since which release it lands in is decided later, on `main`. See
[Releasing](#releasing).

Stop before merging only when the checks are red, the branch conflicts with
`main`, or the change is one you have flagged as needing a human decision. In
that case say so and leave the PR open.

The full test suite must be green before step 1. See
[Test-driven development](#test-driven-development).

## Test-driven development

Every behaviour change starts with a failing test.

1. Write the test. Run it. Watch it fail **for the reason you expect** — a
   test that fails on a typo or a missing import has proved nothing.
2. Write the smallest code that makes it pass.
3. Refactor with the test green.

```bash
npm test            # once
npm run test:watch  # while working
npm run test:coverage
```

Tests live next to the code as `*.test.js` / `*.test.jsx`. The default
environment is `jsdom`; server-side modules opt out per file:

```js
// @vitest-environment node
```

## File extensions

- `.jsx` — anything containing JSX, including Next.js `page` and `layout` files
- `.js` — everything else
- `.mjs` — build and tooling config

This is not cosmetic: Vite's parser selects its grammar by extension, and JSX
inside a `.js` file fails to parse under the test runner.

## Database

See [`migrations/README.md`](../migrations/README.md).
