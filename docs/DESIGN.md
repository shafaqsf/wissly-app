# Design

The visual language of wissly. Binding for every screen. Where this document
and a mockup disagree, this document wins.

## The one idea

wissly is a learning platform. Learning is the movement from noise to signal —
from a subject you cannot yet resolve to one you can.

**So the field is not decoration here. The field is the measure of what is not
yet known.** A topic you have never touched is heavily grained and sits deepest
in the paper. A topic you have mastered is near-clean paper with a breath of
ink left on it. An agent that is still thinking sits in a drifting field; when
it answers, the field settles — the noise clears and the depth drains out of it
together.

Everything else on the page is quiet so that this one device can carry
meaning. If a field on a screen does not encode state, remove it.

## Colour

**There is no colour. The product is ink on paper, and the only exception is
[the mark](#the-mark).**

The field used to carry hue: a heat and a depth and a cool floor, bleeding in
from three edges. It was meant to be the one place colour meant something, and
on real screens it did the opposite — a pink and teal wash behind a heading is
a mood, three of them on one page are a texture pack, and the reading it was
supposed to give (how resolved is this?) was the thing hardest to read out of
it. Depth was always carrying the signal on its own.

So a field is ink, diluted, and nothing else. Every control, every glyph, every
icon, every border, every field is drawn in the same ink. There is no
`--color-field-*` token, and `src/app/globals.css.test.js` fails on any hue in
any source file: a hex whose three channels are not equal, anywhere, is the
rule coming back one component at a time.

### Ink and paper

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#FFFFFF` | Page background. The default surface. |
| `--paper-sunk` | `#F4F4F4` | Recessed surfaces, code blocks |
| `--rule` | `#E4E4E4` | Hairlines, borders, dividers |
| `--ink-faint` | `#9A9A9A` | **Non-text only.** Disabled marks, chart gridlines |
| `--ink-muted` | `#5C5C5C` | Secondary text, captions, metadata |
| `--ink` | `#000000` | Body text, headings, icons, focus rings |

Contrast against `--paper`: `--ink` 21:1, `--ink-muted` 7.0:1, `--ink-faint`
2.8:1. `--ink-faint` therefore never carries text of any size.

### The field, in ink

| Stop | Unresolved | Under way | Settled |
| --- | --- | --- | --- |
| `--field-near` | ink 12% | ink 6% | ink 3% |
| `--field-far` | ink 9% | ink 5% | ink 2% |
| `--field-floor` | ink 6% | ink 3% | ink 2% |
| `--field-mark` | ink 100% | ink 45% | ink 0% |

A field *surface* reads by depth: the less resolved the thing under it is, the
further into the paper it sits. A [field mark](#two-forms) reads by fill
instead — filled, half, empty — because three dilutions two points apart are
three shades of nothing at 12px, while a filled dot beside a half one beside
an empty ring is a legend anyone can read down a column.

### No dark mode

The identity is dark ink on white paper. A dark inversion would break the
grain metaphor — noise on black reads as static, not as uncertainty. Do not
add a `prefers-color-scheme: dark` block.

### No status colours

No red for errors, no green for success. A field's depth says *how resolved
this is*, never *whether something went well*. Status is carried by three
things that work without hue:

- **Words.** "Lesson not saved. Check your connection and try again."
- **An icon**, monochrome, from the same set as everything else.
- **A rule.** A destructive or failed message gets a 2px solid `--ink` left
  border. Nothing else on the page has one, so it reads instantly.

**The rule goes on the message, never on the surface around it.** A 2px side
against the 1px hairline beside it mitres across a `--radius-surface` corner,
and the panel visibly stops being round at both ends of the rule. Every failure
in the product rules its own paragraph — the panel, the auth form, the agent
transcript — and `panel.test.jsx` holds that shape.

This is stricter than accessibility requires, and it is the constraint that
keeps the interface recognisable.

## Type

Three faces, three jobs. Loaded through `next/font/google`, self-hosted, no
runtime request to Google.

| Role | Face | Why |
| --- | --- | --- |
| Display | **Bricolage Grotesque** | Variable width and optical-size axes. Headings can compress and tighten as they grow, which reads as focus — the same movement the grain describes. Used large, used rarely. |
| Body | **Newsreader** | A variable text serif built for long reading. wissly's product *is* reading; a UI sans would make lessons feel like settings screens. |
| Utility | **JetBrains Mono** | Labels, metadata, code, numbers. Anything the system says about itself rather than about the subject. |

### Scale

| Token | Size / line | Face | Notes |
| --- | --- | --- | --- |
| `display-xl` | 72 / 1.0 | Bricolage 800 | `letter-spacing: -0.03em`. One per page, at most. |
| `display-l` | 48 / 1.05 | Bricolage 700 | `-0.02em` |
| `heading` | 30 / 1.2 | Bricolage 600 | `-0.01em` |
| `title` | 22 / 1.3 | Bricolage 600 | |
| `body` | 17 / 1.6 | Newsreader 400 | Default. |
| `body-s` | 15 / 1.6 | Newsreader 400 | |
| `label` | 13 / 1.2 | JetBrains Mono 500 | Uppercase, `letter-spacing: 0.08em` |
| `caption` | 12 / 1.4 | JetBrains Mono 400 | `--ink-muted` |

Below 640px, `display-xl` drops to 44 and `display-l` to 34. Nothing else
changes — the body scale is already right for a phone.

### Measure

Reading columns are capped at **66 characters**. This is not negotiable on
lesson content. Wider is faster to build and slower to read.

## Space

4px base unit. Use only these steps:

```
4  8  12  16  24  32  48  64  96  128
```

Vertical rhythm between sections is 96 on desktop, 64 on mobile. Inside a
component, 16 is the default gap.

## Shape

Soft, but calm. Three steps and no fourth.

| Token | Value | Use |
| --- | --- | --- |
| `--radius-control` | `8px` | Buttons, inputs, chips, nav items, citation marks |
| `--radius-surface` | `14px` | Panels, field surfaces, the agent bar, popovers, cards |
| `--radius-round` | `9999px` | Avatars, count badges, field marks |

Reach for them as `rounded-control`, `rounded-surface`, `rounded-round`.
**Never name a radius token inside a component.** Two spellings for one idea is
how a shape system drifts, and `src/app/globals.css.test.js` fails on it.

Two things stay square, and both for the same reason: they are page *edges*,
not surfaces. The sidebar rail runs to the viewport edge, and so does the
mobile top bar. A rounded corner there opens a gap onto nothing.

Anything carrying `.grain` inherits its parent's radius, so the texture follows
the corner rather than cutting across it. A square grain layer on a rounded
panel is visible immediately, so the rule is enforced in the stylesheet rather
than left to each caller.

Hairlines are `1px solid var(--rule)`. There are no shadows anywhere. Depth
is expressed by `--paper-sunk` and by grain, never by a blur.

## Icons

[Lucide](https://lucide.dev), and nothing else.

- 24px grid, 1.5px stroke, `stroke="currentColor"`, never filled.
- Monochrome. An icon inherits the ink colour of its context.
- Never the only carrier of meaning. Every icon-only control has an
  `aria-label`, and any icon that conveys state sits beside text.
- Do not mix in another icon set, do not recolour, do not add a gradient.

The mark below is not an icon and none of this applies to it.

## The mark

`public/brand/icon.png` — a flame, grained, with heat at its edges and a cool
core. It is the browser tab icon and it is the agent's face, and it is **the
one coloured thing in the product**.

It was once the field palette standing still. The field has no palette any
more, and the mark is better for it: hue no longer means one thing on a
progress surface and another on the tab icon, because it means exactly one
thing now — *this is wissly*. One object in the whole interface is allowed a
hue, and that object is identity, never state. That is a rule you can hold in
one hand, which is more than the old one could claim.

What the exception does not license:

- **One file, one owner.** `src/components/brand/brand-mark.jsx` names the
  asset; everything else composes that component or reads its `MARK` export.
  `src/app/globals.css.test.js` fails if a second file names the path.
- **It is never given a state.** No `.field-*` class, no grain intensity, no
  settle. It does not brighten when the agent works. It is identity, not state,
  and the two must not be confused.
- **It is never the only carrier of meaning.** It is decorative — `alt=""` —
  and the words it sits beside do the work.
- **It is never repeated within a list.** The ban is on repetition, because a
  column of the same colour down a transcript or a table reads as texture, and
  that is exactly what [Grain](#grain) forbids. Two marks in two different
  roles are not repetition: the frame may carry one as the product's identity,
  and a panel that speaks may carry one as its face. Where it goes today:
  the sidebar brand row, the agent panel header, the signed-out field and the
  404 card — the last two because neither renders inside the frame, so nothing
  else on those screens says which product this is.
- **Nothing else follows it.** No coloured illustration, no coloured
  spot art, no second brand asset. This is the exception, in the singular.

## Grain

The signature. One implementation, four intensities, and — inside a field —
a depth of ink that moves with them.

### Source

An SVG `feTurbulence`, inlined as a data URI so it costs no request and
scales without artefacts:

```
<svg xmlns="http://www.w3.org/2000/svg">
  <filter id="g">
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer>
      <feFuncR type="linear" slope="3" intercept="-1"/>
      <feFuncG type="linear" slope="3" intercept="-1"/>
      <feFuncB type="linear" slope="3" intercept="-1"/>
    </feComponentTransfer>
  </filter>
  <rect width="100%" height="100%" filter="url(#g)"/>
</svg>
```

The transfer function is not optional. `fractalNoise` scatters its values
around mid grey, and mid grey composited onto white paper at `--grain-1`
darkens it by under two percent — invisible. Stretching the distribution to
the ends first turns an even wash into scattered dark specks, which is what
grain is. Opacity is not the lever here: raising it would smear grey over the
page rather than scatter grain across it, and it would break the meaning the
four intensities carry.

Applied on a `::before` pseudo-element with `mix-blend-mode: multiply` and
`pointer-events: none`, so it never intercepts a click.

### Intensities

| Token | Opacity | Means |
| --- | --- | --- |
| `--grain-0` | 0 | Mastered. Settled. Nothing left to resolve. |
| `--grain-1` | 0.035 | Ambient. The page itself. |
| `--grain-2` | 0.07 | In progress. Partially learned. |
| `--grain-3` | 0.14 | Unattempted, unknown, or an agent still working. |

### The field

A **field** is clean paper with three stops of ink bleeding in from its edges
— from the bottom-left corner, from the top-right, and a floor rising along the
bottom edge — and a grain layer masked to the same geometry, so the texture is
dense where the ink is deepest and the paper core stays clean. The core is
where text sits.

Every stop is anchored to a corner or an edge, never to a point inside the box.
An interior anchor makes the same class read as three different things
depending on how the surface happens to be cut — a wide header and a tall
column would light from different directions. `globals.css.test.js` asserts the
anchors, and asserts that the grain mask names the same three gradients the
background paints; the moment those drift apart the texture stops tracking the
depth.

Depth and grain are **one axis, not two**. A field is painted by one state
class, and that class moves both:

| Class | Grain | Depth | Means |
| --- | --- | --- | --- |
| `.field-unresolved` | `--grain-3` | deepest | Unattempted, unknown, or an agent still working |
| `.field-partial` | `--grain-2` | half | Under way |
| `.field-settled` | `--grain-0` | a breath | Mastered. Settled. |

`src/lib/mastery.js` is the only place the pairing is written down. A
component reads `grain` and `field` from `masteryState()` rather than choosing
either itself, so the interface cannot say one thing with its texture and
another with its depth.

`.field-settled` is why the stops go down to 2% rather than to nothing.
`--grain-0` alone renders nothing at all, so an arrival used to look like a
missing element. A settled field is still a surface — quiet, faint,
unmistakably *finished*.

### Two forms

The state is one idea. It comes in two sizes, and choosing the wrong one is
what made the earlier screens read as decoration.

**A field surface — `.grain-field`.** Radial geometry, a paper core, holds
text. One per viewport. It belongs to a whole screen or a whole panel, and it
is sized to the object whose state it carries — not to the page it happens to
sit on. A field that fills half a viewport is describing the viewport, and the
viewport does not have a mastery.

**A field mark — `.grain-mark`.** A small round mark: one flat fill, no
geometry, no text. Filled, half, empty — `--field-mark` moves further than the
surface stops do, because 12px of 2% ink is nothing at all. As many per screen as there are objects with a state. A
concept row, a queued item, an agent thinking beside a line of status text.
This is the form to reach for first — the state sits on the thing that has it.

**A flat wash — `.grain-wash`.** For several surfaces appearing at once, such
as panel skeletons: the same state depth as a flat tint, because several
radial gradients at once read as a texture pack rather than as a signal.

### Where a field goes

1. On the object whose state it is — a concept, a queue item, an agent. Prefer
   a mark.
2. The agent's working state.
3. Empty states — a surface with nothing on it yet is, definitionally,
   unresolved.
4. The signed-out frame — the one field carrying an account state rather than
   a knowledge state, and the one to challenge first if the rule ever needs
   tightening.

**Not on a page header.** A header is a position on the page, not a state. A
page-wide band was how the field ended up describing the furniture instead of
the subject.

**Beside a form, never behind or below one.** Never behind a table. Never as a
button fill. Never as a page-wide wallpaper. A form that reports its own
progress uses a mark beside the text, not a surface under the button.

Some screens carry no field at all. Settings has no state worth encoding, and
inventing one there is exactly the decoration this document exists to prevent.

### Text on a field

**Inside a field, text is `--ink`.** `--ink-muted` clears 7:1 on paper and
less than that on an inked field, so it never sits on one; `--ink-faint` never
carries text anywhere. Outside a field, secondary text stays muted, because
there it genuinely is secondary.

The stops are chosen so that `--ink` clears 4.5:1 against the darkest point
any field can reach — every stop overlapping, with the darkest sample of the
grain multiplied on top. `src/app/globals.css.test.js` computes that from the
stylesheet itself and fails if a stop is ever pushed past it.

### Rules

- **Grain never sits under body text above `--grain-2`.** Contrast is not
  negotiable against atmosphere.
- **One field *surface* per viewport.** Two competing radial fields read as a
  texture pack, not as a signal. Marks are exempt: they are identical to each
  other, so a column of them reads as a legend. When a page wants a second
  surface, one of the two becomes a mark.
- **Grain and depth are state, never mood.** If you cannot name the state
  they encode, delete them.
- **Never both.** A field's depth and its grain always come from the same
  state. Setting `--grain` by hand next to a mismatched `.field-*` class is
  the one way to make the signature lie.

## Motion

Motion is rare and it is functional.

- **The settle.** When an agent finishes, or a learner picks a concept they
  have already mastered, its field travels to the new state over 600ms,
  `cubic-bezier(0.16, 1, 0.3, 1)` — grain and depth together, the ink draining
  out of it as the noise clears. This is the only animation anyone should
  remember. The stops are registered with `@property` so the fill can actually
  interpolate; without that the field would jump.
- **The drift.** While an agent works, the grain layer translates by a few
  pixels on a 8s loop. Slow enough to be felt, not watched.
- Everything else — hover, focus, disclosure — is 120ms `ease-out` on opacity
  or transform. No spring, no bounce, no stagger.

`prefers-reduced-motion: reduce` removes the drift entirely and replaces the
settle with an instant state change. The information survives; only the
movement goes.

## Interaction floor

Not optional, not announced:

- Focus is a `2px solid var(--ink)` outline at `2px` offset, visible on every
  focusable element. Never `outline: none` without a replacement.
- Tap targets are at least 44×44px.
- Every screen works at 360px wide.
- Every form control has a real `<label>`. Placeholder text is not a label.
- Buttons say what they do — "Save lesson", not "Submit" — and the same verb
  carries through to the confirmation.

## Writing

Copy is design material. See also the voice rules in
[`CONVENTIONS.md`](CONVENTIONS.md) for repository language.

- Interface language is English. Sentence case everywhere, including buttons.
- Address the learner as "you". The system does not say "we".
- Errors state what happened and what to do next. They do not apologise and
  they are never vague.
- Empty states are an invitation to act, not an apology for emptiness.
- Name things the way a learner would: "course", "lesson", "progress" — never
  "entity", "record", "run" in user-facing text.

## Before you ship a screen

- Is there at most one field *surface*, and does it encode a real state?
- Could a mark have carried that state instead, on the object that has it?
- Does it carry a `.field-*` class? A field without one paints nothing.
- Does anything use colour at all, other than the one mark? Remove it.
- Is any text on a field muted rather than ink?
- Is the reading column at or under 66 characters?
- Does every focusable element show its focus ring?
- Does it hold together at 360px?
- Chanel's rule: take one thing off.
