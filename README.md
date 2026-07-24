# wissly

An open source agentic learning platform.

> Early days. The foundation is in place; the platform itself is not built yet.

## What wissly does

You bring your own material — a script, a slide deck, your notes. wissly
breaks it into a knowledge base, generates study artefacts from it, and
tracks what you can actually do. Not only flashcards and quizzes: layered
summaries, cloze, free recall, explain-it-back, ordering, practice exams. Every
generated claim points back at the passage it came from, and how much grain a
subject carries is how much of it you have not learned yet.

The full catalogue, the staging and the decisions behind them are in
[`docs/superpowers/specs/2026-07-24-wissly-feature-set-design.md`](docs/superpowers/specs/2026-07-24-wissly-feature-set-design.md).

## Stack

| Layer | Choice |
| --- | --- |
| Application | Next.js 16, App Router, JavaScript |
| Styling | Tailwind CSS v4 |
| Persistence | Supabase (Postgres, Auth, row level security) |
| Language models | OpenRouter |
| Tests | Vitest, Testing Library |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase and OpenRouter credentials
npm run dev
```

The app runs on http://localhost:3000.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Re-run tests on change |
| `npm run test:coverage` | Coverage report |
| `npm run lint` | ESLint |

## Layout

```
wissly-app/
├── src/app/       Routes, layouts and pages (App Router)
├── migrations/    Numbered SQL migrations
├── docs/          Conventions and design documents
└── public/        Static assets
```

## Design

Black ink on white paper, monochrome icons, no colour and no dark mode. The
only decorative device is grain — and it is not decorative: noise density
encodes how much of a subject is still unresolved. The rules are binding and
live in [`docs/DESIGN.md`](docs/DESIGN.md).

## Contributing

Two documents, both binding:

- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — branch naming, versioning,
  worktrees, commit format, the test-driven workflow.
- [`docs/DESIGN.md`](docs/DESIGN.md) — colour, type, space, icons, grain,
  motion, interface copy.

Every behaviour change starts with a failing test. Pull requests are opened
and merged by the maintainer; contributors push branches.

## License

[MIT](LICENSE)
