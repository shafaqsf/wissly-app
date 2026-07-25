# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

## [0.14.0] - 2026-07-25

Versions 0.8.0 through 0.13.0 were merged without a bump or a tag. This entry
covers the restructuring released as 0.14.0; the work in between is in the
commit history rather than here.

### Added

- Four areas replace six screens. Courses creates a course and holds its
  shelf — the material, its sections and concepts, and what was read from it.
  Tasks is the workbench: a surface per type, the mixed due queue, bulk
  selection that survives a filter change. Analytics reports mastery, gaps,
  history and what the agent cost. The dashboard answers what to do now.
- A surface per learning format, replacing the one generic renderer: a
  flashcard stack that turns in 3D and a table for tidying, a cloze editor
  that marks the word in place, multiple choice with editable distractors, and
  open questions with the answer drawn from the source.
- Both ways of making something, side by side on every type: write one
  yourself at no cost, or generate from chosen sections with the number of
  model calls shown before the click and a warning for sections that already
  carry that type.
- The agent holds the full writing surface — courses, material, every task
  type, moving, archiving, rescheduling — with an `agent_actions` row and an
  undo behind every call, and it can drive the interface and act on standing
  orders with nobody present.
- Model choice per message: DeepSeek V4 Pro, Claude Sonnet 5 and GPT-5.6 Luna
  with their prices, plus any OpenRouter model id.
- Conversations get an interface at last — history, rename, pin, archive — and
  the bar gains a visible queue, withdraw, stop, streaming over SSE, and a
  failure report naming which writes completed.
- Global search over material, tasks, reading and conversations, answered by
  Postgres full text rather than a model call.
- Anchors lead somewhere. Clicking one opens the passage it points at.
- The keyboard runs a review round: space turns, 1–4 rate, enter advances.
- Export: flashcards as CSV or an Anki import, reading as Markdown. Built in
  the browser, so no endpoint exists for a tool to reach.

### Changed

- Adding material makes no model call. Upload ingests, splits into sections
  and names concepts, and stops; nothing is generated until asked for.
- The motion catalogue grew from two movements to seven — stagger, flip,
  slide, lift and count join the settle and the drift, each with a duration, a
  curve and a reason. Bounce, spring, parallax and autoplay stay forbidden,
  and `prefers-reduced-motion` removes all of it.
- The sidebar carries four destinations and no brand mark; the agent bar is
  now the one place per viewport where the product names itself.
- Settings holds the account and nothing else. Model choice lives in the bar,
  standing orders with the agent, and archives where the archived things are.
- `/review`, `/progress` and `/library` redirect to `/tasks/due`, `/analytics`
  and `/courses`.
- A branch that is the only one in flight now carries its own version bump and
  changelog entry.

### Fixed

- Undo names the run it belongs to. Terminal stream events carried no run id,
  so an undo pressed on an older message reversed the newest run instead.
- Adding material no longer throws after the material has been written.

## [0.7.0] - 2026-07-25

### Changed

- `/` no longer describes the platform. It sends a signed-in learner to the
  dashboard and everyone else to sign-in.
- Migrations are applied by hand in the Supabase SQL editor. The direct
  Postgres connection string is gone from the environment: nothing read it, and
  it carried the database password and the right to disable row level security.

### Fixed

- `/review`, `/progress` and `/library` are guarded by the proxy, not only by
  the frame they render in. A route group name never reaches the URL the proxy
  matches on.
- The hydration mismatch raised by browser extensions writing their own
  attributes onto `<body>` before React hydrates.

### Removed

- The landing page.

## [0.6.0] - 2026-07-24

### Added

- A renderer per stage 1 artefact format: layered summary, glossary, flashcard,
  cloze, multiple choice and open question, dispatched by `Artefact`.
- Citation anchors: a superscript mono numeral that opens the source passage,
  for page anchors and for character-range anchors in pasted text.
- Generated prose rendering — paragraphs, KaTeX mathematics inline and display,
  and code highlighted by weight and italics rather than by hue.
- The daily review queue: one artefact at a time, a four-point rating in words,
  progress through the queue and an empty state that invites.
- Mastery as grain density, one field per viewport, on a new `/progress` route.
- Routes `/review`, `/progress` and `/library`, and a Review destination in the
  sidebar.

## [0.5.0] - 2026-07-24

### Added

- OpenRouter chat client: configurable model, attribution headers, bounded
  retry with exponential backoff on 429 and 5xx, and structured output
  validated against a JSON schema with one repair attempt.
- Ingestion of pasted text and PDFs into ordered sections, each carrying the
  anchor it must be cited by — character offsets for text, page numbers for PDF.
- Artefact generation for the six stage 1 formats, with the format chosen per
  section by an agent, and grading of free-text answers that reports what was
  missing.
- FSRS review scheduling as a pure function over rating and previous state.

## [0.4.0] - 2026-07-24

### Added

- Stage 1 database schema: subjects, sources, sections, concepts, artefacts and
  FSRS reviews, each with row level security and an owner policy for all four
  commands, indexes on every foreign key, and a `reviews(user_id, due_at)` index
  for scheduling.
- A `concept_mastery` view (`security_invoker`) deriving a value in [0,1] per
  concept from the latest review of each of its artefacts. This is what grain
  density renders.
- Browser and server Supabase clients built on `@supabase/ssr`, plus a Next.js 16
  proxy that refreshes the session and gates the dashboard.
- Email and password sign-in, sign-up and sign-out, with the dashboard frame
  verifying the session itself rather than trusting the proxy.
- A test that fails the build if a migration lacks row level security, a
  four-command policy set, an ownership predicate, `with check` on updates, a
  foreign key index, or `security_invoker` on a view.

## [0.3.0] - 2026-07-24

### Added

- The dashboard shell: a collapsible sidebar, panels and a grained empty state.

## [0.2.0] - 2026-07-24

### Added

- Binding design conventions in `docs/DESIGN.md`: monochrome palette, three-face
  type system, spacing and shape scales, icon rules, motion budget and the
  grain system, in which noise density encodes how much of a subject is still
  unresolved.
- Design tokens, `.grain` utility and grainy-gradient field in `globals.css`.
- Agent instructions in `AGENTS.md` directing every agent to read `docs/`
  before editing and to follow the patterns found there.

### Changed

- Type faces are now Bricolage Grotesque (display), Newsreader (body) and
  JetBrains Mono (utility), replacing the starter's Geist pair.
- Landing page rebuilt on the design system.
- Pull requests are created and merged by the maintainer only; branch work
  ends at the push.

### Removed

- Dark mode. The identity is ink on paper.

## [0.1.0] - 2026-07-24

### Added

- Next.js 16 application on the App Router, JavaScript, Tailwind CSS v4.
- Vitest and Testing Library test harness with jsdom and coverage reporting.
- Landing page.
- Migration directory with a numbered, append-only, forward-only convention.
- Contribution conventions: branch naming, versioning, worktrees, commits, TDD.
- MIT license.
