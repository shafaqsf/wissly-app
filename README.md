# wissly

An open source agentic learning platform.

> Early days. The pipeline below runs end to end — material in, artefacts out,
> reviews scheduled, mastery derived — but half the format catalogue is still
> on paper. See [Where things stand](#where-things-stand).

## What wissly does

You bring your own material. wissly reads it, works out what it covers, writes
things for you to answer, schedules them, and keeps a running measure of what
you can actually do. It is not a general chatbot with a study skin on it: every
answer it gives is grounded in a passage of *your* material, and it says which
one.

### 1. Material comes in

A source is pasted text or a PDF, filed under a subject. Typing a subject name
that already exists files it there; a new one starts a subject.

**Ingestion** splits the source into ordered *sections*. A section is the unit
everything downstream hangs off, and no code path may produce one without an
**anchor** back into the original — character offsets for pasted text, a page
number for a PDF. That anchor is what makes citation possible later, so it is a
structural requirement rather than a nicety.

Twelve sections per source is the ceiling. Generation costs a model call per
section, and more than that in one go is a bill rather than a study session.

### 2. Concepts and artefacts come out

Each section gets a **concept** — the thing that section is about — and a set of
**artefacts**, which is what you actually work with. Six formats so far, and an
agent picks which one a section deserves rather than generating all six:

| Format | What it is |
| --- | --- |
| `summary` | Layered: three sentences, then a paragraph, then full depth. You choose how deep to read. |
| `glossary` | A term as the source writes it, with a self-contained definition. |
| `flashcard` | Question, answer. |
| `cloze` | A sentence with one blank to fill. |
| `multiple_choice` | Two to six options, all plausible, and a rationale for each — including why the wrong ones are wrong. |
| `open_question` | Free recall, marked by a model against the source. |

The catalogue is closed on purpose. Every format has a JSON schema in
`src/lib/agent/formats.js` and a renderer in the UI, and the schema is what the
model is constrained to produce — so adding a format means writing its schema
first, not prompting for one and hoping.

**Every generated claim carries a citation.** Artefacts anchor to their section;
agent answers end each sourced sentence with an `[s:SECTION_ID]` marker, which
the interface turns into a numeral you can open to read the passage. A guardrail
fails an answer that read the material and then did not say where from.
Confidently wrong is the one failure this product cannot afford, because you
would memorise it.

### 3. Reviewing

Recall formats go into a queue. Summaries and glossaries do not — they are read,
not answered, so they produce no evidence and have nothing to schedule.

Scheduling is **FSRS** (the Free Spaced Repetition Scheduler), written as a pure
function in `src/lib/review/fsrs.js`: previous card state and a rating in 1..4
in, next state out. It reads no clock it was not given and mutates nothing, so
the whole schedule is reproducible from the review log. `reviews` is an
append-only event log, and the `artefact_schedule` view resolves each artefact's
latest row into its current state so that no query re-derives it.

You rate recall in words — "Not at all", "With effort", "Comfortably",
"Instantly" — and the 1..4 stays inside the scheduler, where it belongs.

### 4. Mastery

Mastery is one number per concept in `[0, 1]`, computed by the
`concept_mastery` view: take every artefact naming the concept, keep only its
most recent review, score that from its rating, and average. Never reviewed
scores zero — unattempted and failed both mean "not yet known".

There is no progress bar and no percentage anywhere in the product. Mastery is
rendered as a mark: filled, half, or an empty ring. That is the whole of it, on
purpose — see [Design](#design).

### The agent

One bar, on every screen, in two modes. The switch says what the agent may
*do*, not which model is behind it:

- **Chat** reads your material and answers. It changes nothing. Its tools are
  `search_sections`, `read_section` and `list_courses`, and that is all it has.
- **Agent** also writes. It holds those three plus `make_artefacts` and
  `rename_course`, and is told to read before it writes and to take the
  smallest reading of a vague request — guessing large fills your review queue
  with work you did not choose.

The guarantee is structural rather than a promise in a prompt. Chat mode cannot
write because the agent it produces holds no tool that writes — not because it
was asked nicely, and not because a button was disabled.

Everything the agent writes is logged as an action together with its inverse, so
**every run can be taken back**. Undo replays those inverses newest first,
guards against double application in the SQL statement itself, and leaves an
action unstamped if its inverse fails — reporting a failed undo as done would be
a lie you could not see through.

Runs are durable: the assistant's message row is written *before* the model is
asked anything. That row is what the interface renders as the working state,
what a reloading client finds, and what a failure has somewhere to be reported.

Models are reached through **OpenRouter**, so which model runs is a config
value rather than a rewrite.

## Where things stand

Built and wired end to end:

- Email and password auth, with row level security on every table
- Pasting text and uploading a PDF, ingested into anchored sections
- Concept and artefact generation across the six Stage 1 formats
- The review queue, FSRS scheduling, and model-marked free recall
- Concept mastery, the dashboard, the library and the progress page
- The agent bar in both modes, with citations, queueing and undo

Not built yet:

- The Stage 2 and 3 formats — comparison tables, ordering, practice exams
- Slides and transcripts as source kinds
- Any preference worth putting on the settings page
- Re-fitting the FSRS weights per learner from the review log

The full catalogue, the staging and the reasoning behind both are in
[`docs/superpowers/specs/2026-07-24-wissly-feature-set-design.md`](docs/superpowers/specs/2026-07-24-wissly-feature-set-design.md).
The agent architecture is in
[`docs/superpowers/specs/2026-07-25-agent-runtime-design.md`](docs/superpowers/specs/2026-07-25-agent-runtime-design.md).

## Stack

| Layer | Choice |
| --- | --- |
| Application | Next.js 16, App Router, JavaScript |
| Styling | Tailwind CSS v4 |
| Persistence | Supabase (Postgres, Auth, row level security) |
| Agents | `@openai/agents`, pointed at OpenRouter |
| Language models | OpenRouter — any model, set per environment |
| PDF text | `unpdf` |
| Maths | KaTeX |
| Tests | Vitest, Testing Library |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase and OpenRouter credentials
```

Then apply the migrations. There is no migration runner and no database
connection string in the environment: paste each file in `migrations/` into the
Supabase SQL editor in ascending order, then clear the Security Advisor.
[`migrations/README.md`](migrations/README.md) explains why it works that way
and what the rules are.

```bash
npm run dev
```

The app runs on http://localhost:3000.

### On row level security

The Supabase publishable key reaches the browser. It grants the `anon` role,
and the only thing between it and the data is RLS — so a table in an exposed
schema without RLS and a matching policy is world-readable to anyone who opens
devtools. RLS is a first-class requirement here, not a hardening pass at the
end. The secret key is server-only, bypasses RLS entirely, and never reaches a
`NEXT_PUBLIC_` variable or a client component.

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
├── src/app/            Routes, layouts and pages (App Router)
│   ├── (auth)/         Sign in, sign up
│   └── (dashboard)/    Dashboard, courses, library, review, progress, settings
├── src/components/     UI, grouped by what it belongs to
│   ├── agent/          The agent bar and its transcript
│   └── artefact/       One renderer per format
├── src/lib/
│   ├── agent/          Agents, tools, ingestion, generation, runs, undo
│   ├── data/           Every query, one module per table
│   ├── review/         FSRS, as a pure function
│   └── supabase/       Browser, server and env plumbing
├── migrations/         Numbered, append-only SQL
├── docs/               Binding conventions and design
└── public/             Static assets
```

Tests live beside the code they cover, as `*.test.js` / `*.test.jsx`. Use
`.jsx` for anything containing JSX and `.js` for everything else — Vite picks
its parser by extension, so JSX in a `.js` file breaks the runner.

## Design

Black ink on white paper. Monochrome icons, no colour anywhere, no dark mode
and no shadows. The single exception is the wissly mark, which is identity and
never state.

State is encoded rather than decorated. A concept, a panel or a working agent
wears a 12px round mark — filled, half, or an empty ring — beside a word that
names the same state, and grain density moves with the fill. Nothing paints a
background: a tint behind a paragraph reads as chrome whatever it was meant to
mean, which is why the product has none.

The rules are binding and enforced by tests that read the stylesheet itself.
They live in [`docs/DESIGN.md`](docs/DESIGN.md).

## Contributing

Two documents, both binding:

- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — branch naming, versioning,
  worktrees, commit format, the test-driven workflow.
- [`docs/DESIGN.md`](docs/DESIGN.md) — colour, type, space, shape, icons,
  grain, motion, interface copy.

Every behaviour change starts with a failing test: write it, watch it fail for
the reason you expect, then write the smallest code that makes it pass.
`npm test` before every commit.

Features go on a branch named `<type>/v<version>-<description>`; configuration,
tooling and docs go straight to `main`. Pull requests are opened, reviewed and
merged by the maintainer — contributors push branches and hand over a suggested
title.

## License

[MIT](LICENSE)
