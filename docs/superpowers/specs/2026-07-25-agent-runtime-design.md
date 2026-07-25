# wissly — the agent

Status: implemented in v0.11.0, except where marked as still open.
Date: 2026-07-25.

## Why this document exists

`src/lib/agent/` is not an agent. It is four stateless functions and a hand
written HTTP client: a schema goes in, a validated object comes out, and
nothing survives the call. That was the right shape for stage 1, where every
generation was one section becoming one artefact.

It is the wrong shape for everything the feature set still promises. "Chat
with your material", "explain it back", Socratic mode and the oral exam are
not one-shot completions. They need a loop, tools, and a memory of what was
already said. This document fixes what the agent is, what it may do, where it
runs, and what the learner sees.

## The decision that shapes the rest

**`@openai/agents` over OpenRouter.** Rejected alternatives, and why:

The **Anthropic Agent SDK** runs Claude Code as its runtime — a subprocess
with a filesystem and `Bash`, `Read`, `Edit`. It is a coding agent pointed at
a repository. wissly's material lives in Postgres, not on disk, so every tool
it ships for free is a tool we would have to switch off, and the deployment
cost of a subprocess with shell access is permanent. The capability we would
be paying for is the one we do not want.

**Keeping the hand written client and adding a loop** is roughly two hundred
lines and no new dependency. It stays the better answer right up until the
first session, the first handoff and the first guardrail — at which point it
is `@openai/agents`, written worse.

`@openai/agents` is a library, not a runtime. No subprocess, no filesystem, in
process in the Node runtime we already have. It brings the tool loop, handoffs
between specialised agents, guardrails, session history, streaming and
human-in-the-loop. Node 22 is required and satisfied (22.14 locally); Zod
joins the dependency list.

Connected through OpenRouter with `setDefaultOpenAIClient` and
`setOpenAIAPI('chat_completions')` — OpenRouter speaks the completions
endpoint, not the Responses API, and the SDK defaults to the latter. The model
stays a matter of configuration: `OPENROUTER_MODEL` continues to decide, so
Claude keeps being the default without the SDK caring.

The cost we accept: the SDK's tracing is built for OpenAI's backend and
degrades with third-party providers. We do not use it. The `agent_runs` and
`agent_actions` tables below are our observability, and they are better suited
anyway — they are per learner, they are subject to RLS, and they survive.

### What survives from `openrouter.js`

Not the module, but not nothing. `parseJsonAnswer` and the schema-repair loop
in `chatStructured` encode two hard-won facts about real providers: they wrap
JSON in prose, and they violate the schema they were handed. The SDK's output
types cover the second case less bluntly than our repair prompt does. Both
stay, as a validation layer around the SDK rather than a client of their own.
`ingest.js`, `formats.js` and `schema.js` are untouched — they never spoke to
a model.

## What the agent is

One agent per job, connected by handoffs. Specialisation is not decoration
here: an agent whose only tool writes flashcards cannot delete a course, and
that is a cheaper security argument than any prompt.

| Agent | Does | Tools |
| --- | --- | --- |
| **Librarian** | Finds material, answers from it, always with an anchor | `search_sections`, `read_section`, `read_anchor` |
| **Maker** | Turns sections into artefacts | `read_section`, `write_artefact` |
| **Examiner** | Asks, grades, records evidence | `next_due`, `grade_answer`, `record_review` |
| **Steward** | Acts for the learner: renames, generates | `search_sections`, `read_section`, `list_courses`, `rename_course`, `make_artefacts` |

The floating bar talks to a **router**, which holds no tools of its own and
hands off. A learner asking "what is a martingale" reaches the Librarian; "make
me cards for chapter 3" reaches the Maker; "test me" reaches the Examiner.

**Every answer that states a fact from the material carries an anchor.** This
is enforced twice — the tools return the anchor alongside the content so the
model cannot lose it, and an output guardrail rejects an answer that cites the
material without one.

## Two modes

The distinction the learner sees is not "which model" but **who acts**.

**Chat** reads. It searches, explains, quizzes informally, and proposes. It
writes nothing except its own messages. Every tool it holds is read-only, so
this is a property of the wiring, not a promise.

**Agent** acts. It has the writing tools, and it works through a task without
asking at each step: add this PDF, generate cards for every section, drop the
duplicates, schedule them.

Switching modes mid-conversation is allowed and is recorded per message. A
conversation is not "a chat" or "an agent run" — it is a thread through which
both happened, and the transcript says which.

## What the agent may do without asking

Full access, with an audit trail and undo — matching what the learner can do
in the interface themselves, on the grounds that an agent which must ask
before every act is a slower way to click.

Three things make that safe rather than reckless:

**It acts as the learner, never above them.** Every tool call goes through the
request-scoped Supabase client carrying the learner's session — the same one
the interface uses, subject to the same policies. `SUPABASE_SECRET_KEY` never
reaches the agent. This is the single most important line in this document.
The agent reads uploaded PDFs and pasted text, which is to say it reads
attacker-controlled input by design; a prompt injection buried in a lecture
handout must be able to do no more damage than the learner could do to their
own account, and no damage at all to anyone else's. RLS is what guarantees
that, and only if the agent never bypasses it.

**Every write is recorded and reversible.** An `agent_actions` row per tool
call: which tool, which arguments, which rows it touched, and the payload
needed to undo it. The interface offers "Undo" on the message that caused it.

**Destruction is soft.** `delete` sets `archived_at`; nothing is removed from
the database by an agent, ever. The learner empties the archive by hand.

Two acts remain outside the agent's reach regardless of mode, because no undo
restores them: anything touching auth (email, password, deleting the account),
and export or sharing, which sends data outward.

## Conversations

Persistence is a table, and the four verbs the learner asked for are columns
and one action each.

```
conversations   id, user_id, title, mode, pinned_at, archived_at,
                created_at, updated_at, last_message_at
messages        id, conversation_id, user_id, role, content, mode,
                status, anchors jsonb, created_at
agent_runs      id, conversation_id, message_id, user_id, agent,
                model, status, usage jsonb, error, started_at, ended_at
agent_actions   id, run_id, user_id, tool, arguments jsonb,
                result jsonb, undo jsonb, undone_at, created_at
```

`user_id` and a policy on all four from the first migration, per `AGENTS.md`.

**Titles** are generated from the first exchange and are editable — renaming
is an `update` on one column.

**Pinning** is `pinned_at`, not a boolean, so the pinned list has an order.

**Archiving and deletion** are both `archived_at`. There is one destructive
path in the product, it belongs to the learner, and it lives in the archive.

**Queueing** is `messages.status`. A message sent while a run is in flight is
written immediately as `queued` and rendered immediately — the learner never
waits for a text field to become available again. When the run ends, the queue
drains in order into the same conversation. A queued message can be withdrawn
before it starts; one that has started cannot, it can only be stopped, which
ends the run and marks it `stopped`.

This is also the answer to page reloads and closed laptops. The run is a row,
not a promise held in a component. Reconnecting reads its state.

## Where it runs

A run is not a request. Generating artefacts for a fifty-page PDF is minutes
of tool calls, and the browser is entitled to leave.

The floating bar posts a message and gets back a run id. A route handler
streams that run's events, and streaming works on the default Node runtime —
no `runtime = 'edge'` and no reason for it, since the SDK wants full Node.
Reconnecting to a run in progress resumes the stream from what has already
been persisted, because every event is written as it happens rather than at
the end.

Long runs on serverless want the function timeout raised and the work broken
at tool boundaries; a run that hits the ceiling is marked `interrupted` and
continues from its last completed tool call rather than starting over. There
is no separate worker and no queue infrastructure — `messages.status` already
is the queue, and adding a broker to a product with no users yet would be
building for a load that does not exist.

## What the learner sees

**A floating bar, centred.** It is present on every screen behind the
dashboard shell, it holds the mode switch, and it is the only entry to the
agent. Collapsed it is a single line. Focused it lifts into a panel: the
transcript above, the field below, conversations reachable from its edge.

It obeys `DESIGN.md` without exception — chrome in ink only, Newsreader for
what the agent says, JetBrains Mono for what the system says about itself,
hairlines and no shadow. A floating element with no shadow needs a `--paper`
fill and a `--rule` hairline to separate from the page. That is the whole
treatment.

**The field is the working state and nothing else on this surface.** While a
run is in flight the panel is a `grain-field` carrying `.field-unresolved` at
`--grain-3` with the drift; when the answer lands it becomes `.field-settled`
at `--grain-1` over 600ms. This is the animation `DESIGN.md` says is the only
one anyone should remember, and the agent is where it belongs.

The `.field-*` class is not optional and not decoration. A `grain-field`
without one paints transparent stops and renders as clean paper — a field
encoding nothing, which is exactly what `DESIGN.md` forbids and what
`globals.css.test.js` fails the build over. Naming the state is how colour
stays a signal rather than becoming a style.

Which raises the constraint that the bar has to respect: **one grain field per
viewport.** The bar floats over pages that already have one — the courses
empty state, the progress field. While the agent works, the bar's field is the
one that counts and the page's is suppressed to `--grain-1`. Only one thing
can be the unresolved thing.

### Grain is currently invisible, and that is a bug

The tokens are right, `.grain` is implemented as `DESIGN.md` specifies, and
the result on screen is nothing at all.

`feTurbulence` with `type="fractalNoise"` produces noise distributed around
mid grey. Desaturated and composited with `multiply` at `--grain-1`'s 0.035,
the darkest pixel darkens white paper by under two percent. Even `--grain-3`
at 0.14 lands around seven percent on the extremes and far less on average.
The specification is being followed exactly and rendering nothing, which is
the worst kind of correct.

The fix is contrast, not opacity — raising opacity to compensate would smear
grey over the page instead of scattering grain across it. A
`feComponentTransfer` with a discrete transfer function pushes the turbulence
toward black and white before it is composited, so the same 0.035 buys visible
grain rather than a faint wash. The four intensity tokens keep their values
and their meanings; only the image behind them changes.

The reference the discussion started from (`gggrain`) gets its presence from
two things: colour in the gradient, and contrast in the noise. The field
palette merged in v0.9.0 supplies the first. This supplies the second — and
the two are independent, which is why the field could already be visible while
the grain over it still was not.

## Testing

Every behaviour change starts with a failing test, per `AGENTS.md`.

The agent layer is tested against a fake model, not the network: the SDK
accepts a custom client, so a client that returns scripted tool calls makes
handoffs, guardrails and the repair loop testable without a key and without a
bill. The existing `fake-supabase.js` covers the tool side, so a tool test
asserts which rows a tool touched under which identity.

What must be covered, because it is what would hurt: a tool called with the
secret key fails the test suite; an answer citing material without an anchor
is rejected by the guardrail; a queued message survives a stopped run; an undo
restores the row the action changed; a run interrupted mid-way resumes at its
last completed tool call rather than repeating it.

## What shipped in v0.11.0

1. **Runtime.** `@openai/agents` on chat completions through OpenRouter,
   tracing off, tested against a scripted model rather than the network.
2. **Persistence.** Migration `005` — conversations, messages, agent_runs,
   agent_actions — with `user_id` and four policies each, and the data access
   layer beside the existing modules in `src/lib/data/`.
3. **The bar.** Floating, centred, both modes, queueing, the field as the
   working state, and the contrast fix that makes the grain over it visible.
4. **Autonomy, in its first form.** The Steward holds two writing tools —
   `rename_course` and `make_artefacts` — and every call it makes writes an
   `agent_actions` row carrying the payload that reverses it. Undo walks a run
   newest-first, guarded so two clicks resolve to one.

## Still open

- **Streaming.** A turn runs to completion and the answer lands at once. The
  rows are shaped for streaming — the assistant message exists at `running`
  from the start — but nothing streams yet.
- **The conversation list.** Renaming, pinning, archiving, restoring and
  deleting exist as tested server actions with no interface on them. The bar
  opens a fresh thread each time.
- **The remaining agents.** Maker, Examiner and the handoff router. The
  Steward covers the writing half of the Maker's job for one passage at a
  time; grading and scheduling are untouched.
- **The rest of the writing surface.** Moving material between courses,
  archiving a source, emptying the archive.

## Out of scope

Voice, multi-user conversations, agent-initiated messages without a learner
present, and any tool that reaches outside wissly — no web search, no email,
no calendar. The agent works from your material. That is the product.
