# wissly — the four areas

Status: agreed design, not yet implemented.
Date: 2026-07-25.
Supersedes parts of [`2026-07-24-wissly-feature-set-design.md`](2026-07-24-wissly-feature-set-design.md)
and [`2026-07-25-agent-runtime-design.md`](2026-07-25-agent-runtime-design.md).

## Why this document exists

The application has six screens and every one of them is an overview. There is
no course page, no place to work, and almost no actions — across all six there
are three buttons. Everything generated lands in one flat list in the library.
The `Panel` frame that was built to hold all of this is used on exactly one
page.

At the same time the upload path generates on its own: hand over a PDF and up
to twelve model calls decide, without asking, that section 3 deserves a
flashcard. That is the behaviour that started this redesign, and it is the
first thing to go.

This document fixes the shape of the application: four areas, what each one
answers, what the agent may do across them, and what the interface looks like
while it happens.

## The decision that shapes the rest

**Understanding lives with the material; recall lives with the tasks.**

Of the six stage 1 formats, only four are tasks. A flashcard, a cloze, a
multiple choice question and an open question are asked of you; you answer;
evidence results. A summary and a glossary ask nothing — they are read.

So the split is not by format catalogue but by whether the thing produces
evidence:

- **Read** — summary, glossary, and later comparison table, concept map,
  worked derivation. These are processed material. They belong beside the
  source they came from, on the course page.
- **Answered** — flashcard, cloze, multiple choice, open question, and later
  ordering, free recall, practice exam. Only these run through FSRS, only
  these feed mastery, only these have a due date. They belong in Tasks.

Every area then answers one question that no other area answers:
*what do I have* — *what can I do* — *how is it going*.

## The term "artefact"

`artefacts` stays as a table and as a word in the code. It carries the shared
column, the anchor and the scheduling, and renaming it would be a migration
that buys nothing.

**It never appears in the interface.** The learner reads `Flashcards`,
`Cloze`, `Summary`. Where a collective noun is needed the interface says
`Tasks` or `Reading`.

## The areas

```
Dashboard    The day: what is due, what the agent did, what is weak
Courses      Create a course; its shelf — sources, sections, concepts, reading
Tasks        The workbench — generate, edit, practise, per type
Analytics    Mastery, gaps, history, cost
─────────
Settings     The account, and nothing else (sidebar foot, not main nav)
```

Four entries in the sidebar, `Settings` in its foot, and no brand mark —
`sidebar.jsx` gives its `BrandMark` up, which leaves the agent bar as the one
place per viewport where the product names itself.

### Dashboard

One page answering "what now". Every surface is an entrance; nothing here is
decoration.

| Surface | Content | Leads to |
| --- | --- | --- |
| The action | "12 tasks due · 3 overdue" + `Start a round` | `/tasks/due` |
| While you were away | What the agent did autonomously, each row with `Undo` | the affected surface |
| Weakest | Five concepts with the lowest mastery, as grain marks | `/analytics?concept=…` |
| Courses | Title, size, concepts settled, grain | `/courses/[id]` |
| Recently | Last source, last generated tasks, last conversation | each to its own place |
| This week | Reviews per day as hairline bars. No percentage, no streak | `/analytics` |
| Effort | Model calls and cost over seven days | `/analytics` |

The last one matters: with the agent acting autonomously, what that costs has
to be visible somewhere the learner passes daily.

### Courses

`/courses` creates and lists. Creating a course is a thing the learner does —
today courses only appear as a side effect of adding material.

`/courses/[id]` is the shelf, and it is where material is added from now on:

- **Add material** — the form that lives in `/library` today, moved here, so
  a source is filed at the moment it arrives instead of guessing a subject.
- **Sources** — each expandable into its sections, each section showing its
  anchor.
- **Concepts** — what the material covers, with mastery as grain.
- **Reading** — the summaries and glossary entries generated from this
  material, beside the material.
- **A line, not a copy** — "34 tasks →" links into Tasks scoped to this
  course. The task surfaces are not rebuilt here.
- **Archive** — this course's archived sources and reading.

### Tasks

The workbench. Course picker at the top, types on the left, the working
surface on the right.

```
Tasks                              Course: Analysis I ▾   (or: All courses)
──────────────────────────────────────────────────────────────────────────
  Due             12  │
  Flashcards      34  │   Filter: source ▾  section ▾
  Cloze            8  │   [ Write one ]  [ Generate from material ]
  Multiple choice  6  │
  Open questions   4  │   … the type's own surface …
  ─────────────────── │
  Archive             │
```

Each type gets its own surface rather than a shared dispatcher. The generic
`<Artefact>` component is retired; `flashcard-artefact.jsx` and its siblings
become the read-only renderers those surfaces use.

| Type | Its surface |
| --- | --- |
| Flashcards | A stack for practice and a table for tidying. The card turns in 3D |
| Cloze | The sentence with `____`; the editor marks the word to remove in place |
| Multiple choice | Question, one right answer, three distractors, each editable |
| Open questions | Question plus the model answer drawn from the source |
| Due | The FSRS queue across every type, mixed — today's `/review`, moved |

Two ways in, side by side on every type: **Write one** opens an empty form and
costs nothing, **Generate from material** selects sections and shows the
number of model calls before the click. Nothing is generated on upload any
more.

Selection is multi-row and survives a filter change, so archiving, moving,
rescheduling and re-typing work in bulk, across courses when the picker says
`All courses`.

### Analytics

Mastery per concept as grain (the existing `ConceptMastery`), plus what the
progress page never had: a gap report naming what demonstrably does not hold
yet and linking to its source, history over time, and effort — model calls and
cost, by day and by cause.

### Settings

The account: email, password, sign out, delete account. Nothing else.

Model choice lives in the agent bar. Standing orders live with the agent.
Archives live where the archived things live.

## What happens to what exists

| Today | After |
| --- | --- |
| `/library` | Dissolved. Form, sources and reading all move to the course page |
| `/review` | Becomes `/tasks/due`. `ReviewSession` and `RatingButtons` survive |
| `/progress` | Becomes `/analytics`. `ConceptMastery` survives and gains company |
| `/courses` | Gains creation and detail pages |
| `<Artefact>` dispatcher | Retired; per-type surfaces replace it |
| `generateArtefacts()` in `add-material.js` | Removed from the upload path |
| `Panel` | Used everywhere, not only on the dashboard |
| Six nav entries | Four, plus Settings in the foot, minus the brand mark |

## The agent

**One bar, one thread, two modes.** Chat and Agent are a dropdown, not two
interfaces. The mode is recorded per message (`messages.mode` already exists),
so switching mid-conversation is normal: ask what a σ-algebra is in Chat,
switch to Agent, say "make me ten cards on that" — same thread, same context,
and the transcript says who acted on every line.

The difference between the modes is **who acts**, not which model. Chat holds
only reading tools; that is wiring, not a promise. Agent holds the writing
ones.

### Reach

Full autonomy. Three levels, each including the last:

1. **It writes data** — create and rename courses, ingest material, generate
   every task type, edit, move, archive, write reading, reschedule reviews.
2. **It drives the interface** — navigate to where a result landed, set the
   course picker, open a type, apply a filter, start a review round.
3. **It decides** — standing orders let it act with nobody present: notice
   concepts below `--grain-2` and generate more, plan the week, archive
   duplicates.

What holds this safe is unchanged and non-negotiable:

- **It acts as the learner.** Every tool call goes through the request-scoped
  Supabase client carrying the learner's session. `SUPABASE_SECRET_KEY` never
  reaches the agent. Uploaded material is attacker-controlled input by design;
  a prompt injection in a lecture handout must be able to do no more than the
  learner could do to their own account, and nothing at all to anyone else's.
- **Every write is recorded and reversible** — one `agent_actions` row per
  tool call, carrying the payload that undoes it.
- **Destruction is soft** — `archived_at`, never `delete`.
- **Auth and export stay out of reach.** Export is the one path that carries
  data out of the account, so it is a thing only the learner triggers. This is
  the reason export exists as a feature and still is not a tool.

There is no spending cap. Cost is visible on the dashboard and in Analytics;
it is not enforced.

### Standing orders

A standing order runs without a request, which is infrastructure the product
does not have: `agent_runs` always has a `conversation_id` today. It needs a
table of orders, a schedule, and a trigger that is not a page load.

It is the last thing built, so it blocks nothing, and its report still lands as
a message in a thread so that everything the agent did is in one place.

### Models

Chosen per message, in the bar, beside the mode. `messages.model` records what
answered, and the transcript shows it.

| Model | OpenRouter id | Price / 1M in · out |
| --- | --- | --- |
| DeepSeek V4 Pro | `deepseek/deepseek-v4-pro` | $0.44 · $0.87 |
| Claude Sonnet 5 | `anthropic/claude-sonnet-5` | $2.00 · $10.00 |
| GPT-5.6 Luna | `openai/gpt-5.6-luna` | $1.00 · $6.00 |

Plus a free field taking any OpenRouter model id, because a curated list of
three goes stale and the catalogue has hundreds. `OPENROUTER_MODEL` stays as
the default for a learner who has never chosen.

Mode and model are independent: Chat on Sonnet while the Agent works on
DeepSeek is a normal configuration.

### The bar

The interface in the screenshot is two toggle buttons and a transcript. What
it needs:

- **Mode as a dropdown**, model as a second dropdown beside it.
- **Conversation history** — the list that does not exist. `rename`, `pin`,
  `archive` and `restore` already exist as tested server actions with no
  interface on them; this is where they surface.
- **The queue, visibly.** A message sent while a run is in flight is written
  `queued` and rendered immediately. It can be withdrawn before it starts.
- **Stop.** A running turn ends and is marked `stopped`.
- **Streaming.** Today a turn runs to completion and the answer lands at once.
  The rows are already shaped for it.
- **Undo** on the message that caused the writes.
- **A failure state that says what got through.** With thirty writes in a run,
  a run that dies halfway must report what completed, or undo is guesswork.
- **Standing orders** as a surface of its own, beside the history.

## Motion

`DESIGN.md` says motion is rare and functional, and names two movements: the
settle and the drift. That rule is relaxed here, deliberately, and the
document is rewritten in the same change rather than quietly broken.

The catalogue grows; it stays named. Every movement has a duration, a curve
and a reason:

| Movement | Where | Spec |
| --- | --- | --- |
| Settle | An answer lands, a concept resolves | 600ms `cubic-bezier(0.16, 1, 0.3, 1)` — unchanged |
| Drift | The agent is working | 8s loop — unchanged |
| Stagger | A list appears | 40ms offset, at most 6 items, then all at once |
| Flip | A flashcard turns | 300ms, 3D, `ease-out` |
| Slide | Panel and type changes | 200ms `ease-out` on transform |
| Lift | Hover on an interactive surface | 120ms, 1px rise, hairline darkens |
| Count | A number changes | 400ms, monospace, no easing bounce |

Still forbidden: bounce, spring, parallax, autoplay, and any movement that
carries information nothing else carries. `prefers-reduced-motion: reduce`
removes all of it and leaves the state changes instant.

Everything else in `DESIGN.md` holds without exception: ink only in the
chrome, hue only inside a grain field, one field per viewport, hairlines and
no shadow.

## Also in scope

**Empty states carry the product now.** Nothing is generated on upload, so a
new account sees empty surfaces everywhere. Each one says what the next step
is and offers it.

**Duplicate protection.** Manual and agent creation reach the same sections.
Generation shows which sections already have this type before the click.

**The keyboard runs a review round.** Space turns the card, 1–4 rates, Enter
advances. A daily surface that needs a mouse does not get used daily.

**The anchor becomes clickable.** "Every claim points at its source" is the
product's promise and today the anchor is text with no destination. Clicking
it shows the passage. `citation-anchor.jsx` is the shell that gets filled.

**Global search.** One field over sources, sections, concepts, tasks, reading
and conversations; a hit leads to where the thing lives. Postgres full text —
a `tsvector` column and a GIN index per table, one union query. Searching is a
reflex, not a question, and a reflex should not cost a model call.

**Export.** Flashcards as an Anki deck or CSV, reading as Markdown or PDF, a
course as a whole. Sharing is a link that someone without an account can read.
Learner-triggered only, never a tool.

## Testing

Every behaviour change starts with a failing test, per `AGENTS.md`.

What must be covered, because it is what would hurt:

- Adding material makes no model call.
- A tool called with the secret key fails the suite.
- An answer citing material without an anchor is rejected by the guardrail.
- A queued message survives a stopped run.
- An undo restores the row its action changed.
- A run that dies halfway reports which writes completed.
- Generating a type a section already has warns before it spends.
- Every new table has RLS and an ownership predicate from its first migration.
- `prefers-reduced-motion` removes every movement in the new catalogue.

The agent layer keeps being tested against a scripted model rather than the
network, and `fake-supabase.js` keeps covering the tool side.

## Out of scope

Voice, multi-user conversations, and any tool reaching outside wissly — no web
search, no email, no calendar. The agent works from your material. That is the
product.
