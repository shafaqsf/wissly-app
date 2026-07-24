# Conventions

How work moves through this repository. English everywhere: branch names,
commits, code, comments, docs.

## What needs a branch, and what does not

| Kind of change | Where |
| --- | --- |
| A feature, or a fix to one | Feature branch in its own worktree, then a PR |
| Configuration, tooling, CI, dependency bumps, docs | Directly on `main` |

Configuration is not a feature. Adding a linter rule, bumping Next.js, or
fixing a typo in this file does not justify a branch, a worktree, or a pull
request — commit it to `main` and, if it is worth a version, release it there.

## Branch names

```
<type>/v<version>-<short-description>
```

- `<type>` — `feat` `fix` `refactor` `perf` `test`
- `<version>` — the version this branch will produce once merged
- `<short-description>` — lower case, kebab-case, two to four words

```
feat/v0.2.0-supabase-migrations
feat/v0.3.0-openrouter-client
fix/v0.3.1-openrouter-retry-backoff
refactor/v0.4.0-agent-run-store
```

The version in the name is a statement of intent. If the scope of the branch
changes, rename the branch (`git branch -m`) before opening the PR.

Two branches must never claim the same version. Check `git tag` and the open
branches before you pick one.

## Versioning

Semantic versioning, pre-1.0:

| Change | Bump |
| --- | --- |
| New capability | minor — `0.2.0` → `0.3.0` |
| Bug fix, no behaviour added | patch — `0.3.0` → `0.3.1` |
| Breaking change | still minor, until `1.0.0` |

`1.0.0` is the point at which the public surface — the database schema, the
agent API and the env contract — is considered stable.

### The bump does not happen in the feature branch

A feature branch touches neither `package.json` nor `CHANGELOG.md`. Both are
edited only on `main`, immediately after the merge:

```bash
git switch main && git pull
npm version 0.3.0 --no-git-tag-version   # package.json + package-lock.json
# add the CHANGELOG.md entry — the PR body carries the text
git commit -am "chore(release): 0.3.0"
git tag -a v0.3.0 -m "0.3.0"
git push && git push --tags
```

This is what keeps parallel worktrees from fighting over the same two files.

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
    ├── wissly-app/                          <- main
    ├── feat-v0.3.0-openrouter-client/       <- worktree
    └── fix-v0.3.1-openrouter-retry/         <- worktree
```

The directory name is the branch name with `/` replaced by `-`.

```bash
# start
git worktree add ../feat-v0.3.0-openrouter-client -b feat/v0.3.0-openrouter-client
cd ../feat-v0.3.0-openrouter-client && npm install

# finish
git push -u origin feat/v0.3.0-openrouter-client
# open and squash-merge the PR on GitHub, then:
cd ../wissly-app
git worktree remove ../feat-v0.3.0-openrouter-client
git branch -d feat/v0.3.0-openrouter-client
```

Each worktree needs its own `npm install` and its own `.env.local` — neither
is tracked by git.

## Pull requests

PRs are squash-merged, so the PR title becomes the single commit on `main`.
Write it as a Conventional Commit:

```
feat(agent): add OpenRouter chat completion client
```

The PR body states the target version and carries the CHANGELOG text ready to
paste:

```markdown
Target version: 0.3.0

### Added
- OpenRouter chat completion client with configurable model and retry on 429.
```

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
