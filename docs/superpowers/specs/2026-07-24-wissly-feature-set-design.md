# wissly — feature set

Status: agreed design, not yet implemented.
Date: 2026-07-24.

## Why this document exists

The repository holds a landing page, a design system and an empty
`migrations/` directory. Everything else is undecided. This document fixes
what wissly does, so that the first migration and the first agent are built
towards something rather than around it.

The reference point is Studyflash: upload your material, get study artefacts
back. wissly differs in two deliberate ways. It generates far more than
flashcards and quizzes, because those are only two of many ways to force
recall. And it renders all of it under the constraints in
[`DESIGN.md`](../../DESIGN.md) — black ink on white paper, no colour, grain
carrying state.

## Decisions already taken

**Accounts, not local-only storage.** Row level security presupposes an
identity: a policy says "this row belongs to this person", and without
`auth.uid()` in the session there is nothing to check against. The
alternatives are worse — no policy at all exposes every user's data to the
publishable key that reaches the browser, and a policy with only
`TO authenticated` checks the role rather than the rows, which `AGENTS.md`
already rejects. Supabase anonymous sign-in remains available later as a way
to skip the sign-up form without giving up row ownership.

**Every table carries `user_id` and a policy from its first migration.**
Security is not a later pass.

## The model

Four layers, in order:

```
Source  →  Knowledge base  →  Artefact  →  Mastery
(upload)   (sections,         (a format,   (per concept; drives
            concepts,          generated)   grain and review)
            anchors)
```

Mastery is the hinge. Every artefact produces evidence of what the learner
can do; review scheduling reads that evidence; and the grain density on every
screen renders it. Without this layer wissly is a generator, not a learning
tool.

Every section keeps its **anchor** — page, slide, or timestamp. This is what
lets any generated claim point back at its source, and it is why anchors are
part of ingestion rather than an afterthought.

## Inputs

| Input | How | Stage |
| --- | --- | --- |
| Pasted text | A text field | 1 |
| PDF | Text extraction, page anchors | 1 |
| Slides (PPTX) | Text per slide, slide-number anchors | 2 |
| DOCX, Markdown, EPUB | Convert to Markdown | 2 |
| Handwritten notes (photo) | Vision model via OpenRouter, learner corrects the transcription | 2 |
| Web link | Article extraction | 2 |
| YouTube | Transcript, timestamp anchors | 2 |
| Lecture recording (audio) | Transcription, timestamp anchors | 3 |
| Figures inside PDFs | Vision description attached to the section | 3 |
| Anki deck (`.apkg`) | Import existing cards | 3 |

## Artefacts

Flashcards and quizzes are two ways of forcing recall. The catalogue
therefore separates **understanding** from **recall**.

### Understanding

| Format | What it does | Stage |
| --- | --- | --- |
| Layered summary | From three sentences to full depth, switchable | 1 |
| Glossary | Term, definition, source anchor | 1 |
| Worked derivation | A proof or calculation, step by step | 2 |
| Comparison table | Two to four concepts side by side | 2 |
| Concept map | What connects to what | 2 |
| Prerequisite graph | What you need before a concept makes sense | 3 |
| Timeline | For anything historical or procedural | 3 |
| Analogy and counter-example | One picture for it, one case where it breaks | 3 |
| Audio walkthrough | A spoken pass over the material | 3 |

### Recall

| Format | What it does | Stage |
| --- | --- | --- |
| Flashcard | Front and back | 1 |
| Cloze | A key term removed from its sentence | 1 |
| Multiple choice | With reasoned distractors | 1 |
| Open question | Free text, graded against the source | 1 |
| Free recall | "Write down what you know about X" — the agent marks what was missing | 2 |
| Explain it back | You explain, the agent finds the gaps | 2 |
| Matching | Term against definition | 2 |
| Ordering | Put the steps of a derivation in sequence | 2 |
| Find the error | A derivation with one fault planted in it | 3 |
| Transfer task | Apply the idea to an unfamiliar case | 3 |
| Calculation with step checking | The error is reported where it happened | 3 |
| Practice exam | Mixed formats, timed, scored, with feedback | 3 |
| Oral exam | The agent follows up where you sound unsure | 3 |

### Dialogue

| Format | What it does | Stage |
| --- | --- | --- |
| Chat with your material | Answers from your sources only, shows the anchor | 1 |
| Socratic mode | Asks back instead of solving | 2 |

**Choosing a format.** Formats are fixed — each has a schema. Which format a
section gets is decided by an agent: a definition becomes a flashcard, a
derivation becomes an ordering task, a contrast becomes a comparison table.
The learner can override the choice.

## Review and progress

- Spaced repetition (FSRS) over **every** recall format, not only flashcards
- A mastery value per concept, merged from all evidence
- A gap report: what demonstrably does not hold yet, linked to its source
- No streaks, no points, no badges — they do not fit the design language

Grain carries progress. An untouched concept sits at `--grain-3`, one in
progress at `--grain-2`, a mastered one at `--grain-0`. A subject shows the
average of its concepts. This is the progress display; there is no second one.

## Rendering

"Modern rendering" collides with "no colour" in three places. These
resolutions are binding.

- **Mathematics.** KaTeX, rendered on the server. For a learning tool
  formulae are routine, not an edge case.
- **Code.** Syntax highlighting through weight and italics, never through
  hue: keywords bold, comments italic `--ink-muted`, everything else `--ink`.
- **Concept maps and graphs.** Nodes are text on `--paper`, edges are
  `--rule` hairlines, weight is expressed as grain density.
- **Anchors.** Every generated claim carries a superscript mono numeral;
  activating it opens the source passage.
- **A working agent.** `--grain-3` with drift, then the settle to
  `--grain-1`. This is the only loading state in the product.
- **The 66-character measure holds** for generated prose. Tables and graphs
  may break out of it; running text never does.

## Platform

- Supabase Auth; `user_id` and a policy on every table from the first
  migration
- Subjects as the top-level unit of organisation
- Export of your own data as Markdown and Anki — non-negotiable for an open
  source tool
- Model and cost transparency through OpenRouter
- Later: share a subject, hand on a deck

## Out of scope

Video, live teaching, a marketplace, certificates, mobile apps, gamification,
courses with a teacher role.

## Staging

**Stage 1 — the smallest thing that genuinely helps someone learn.**
Pasted text and PDF; a knowledge base with anchors; layered summary, glossary,
flashcard, cloze, multiple choice, open question; chat with anchors; FSRS
review; mastery and grain; auth and RLS.

**Stage 2 — breadth.** The remaining inputs including handwriting and
YouTube; the understanding formats; free recall, explain it back, matching,
ordering; Socratic mode.

**Stage 3 — depth.** Practice and oral exams, transfer and calculation tasks,
audio in and out, prerequisite graph, sharing.

Stage 1 is the subject of the next implementation plan.
