# wissly

An open source agentic learning platform.

> Early days. The foundation is in place; the platform itself is not built yet.

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

## Contributing

Read [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) first — it covers branch
naming, versioning, worktrees, commit format and the test-driven workflow.
Every behaviour change starts with a failing test.

## License

[MIT](LICENSE)
