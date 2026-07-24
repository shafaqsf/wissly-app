# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

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
