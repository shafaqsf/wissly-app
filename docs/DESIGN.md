# Design

The visual language of wissly. Binding for every screen. Where this document
and a mockup disagree, this document wins.

## The one idea

wissly is a learning platform. Learning is the movement from noise to signal —
from a subject you cannot yet resolve to one you can.

**So the field is not decoration here. The field is the measure of what is not
yet known.** A topic you have never touched wears a filled mark. A topic you
have mastered wears an empty ring. An agent that is still thinking wears a mark
that drifts; when it answers, the mark settles — the noise clears and the fill
drains out of it together.

Everything else on the page is quiet so that this one device can carry
meaning. **The page itself is always clean paper.** If a field on a screen does
not encode state, remove it — and if it is bigger than a mark, it is already
wrong.

## Colour

**There is no colour. The product is ink on paper, and the only exception is
[the mark](#the-mark).**

The field used to carry hue: a heat and a depth and a cool floor, bleeding in
from three edges. It was meant to be the one place colour meant something, and
on real screens it did the opposite — a pink and teal wash behind a heading is
a mood, three of them on one page are a texture pack, and the reading it was
supposed to give (how resolved is this?) was the thing hardest to read out of
it.

Then it was ink at a dilution instead of a hue, which was better and still
wrong: grey behind a paragraph is a background, and a background reads as
chrome no matter what it was meant to encode. So a field is not a surface at
all now. See [The field](#the-field).

Every control, every glyph, every icon, every border, every mark is drawn in
the same ink. There is no `--color-field-*` token, and
`src/app/globals.css.test.js` fails on any hue in any source file: a hex whose
three channels are not equal, anywhere, is the rule coming back one component
at a time.

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

| | Unresolved | Under way | Settled |
| --- | --- | --- | --- |
| `--field-mark` | ink 100% | ink 45% | ink 0% |

One fill, three values, far enough apart to tell at 12px: filled, half, empty.
That is the whole palette of the product. `globals.css.test.js` asserts the
three values stay separated, because dilutions two points apart are three
shades of nothing.

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
| `--radius-surface` | `14px` | Panels, the agent bar, popovers, cards |
| `--radius-round` | `9999px` | Avatars, count badges, field marks |

Reach for them as `rounded-control`, `rounded-surface`, `rounded-round`.
**Never name a radius token inside a component.** Two spellings for one idea is
how a shape system drifts, and `src/app/globals.css.test.js` fails on it.

Two things stay square, and both for the same reason: they are page *edges*,
not surfaces. The sidebar rail runs to the viewport edge, and so does the
mobile top bar. A rounded corner there opens a gap onto nothing.

Anything carrying `.grain` inherits its parent's radius, so the texture follows
the corner rather than cutting across it. The rule is enforced in the
stylesheet rather than left to each caller.

**A focus outline follows the element's own corner.** So a control with no
radius draws a square ring in an interface that has none — which is how a
square kept appearing around the agent's text field, the concept rows, the
wordmark, the file picker and every radio. Every focusable element carries a
radius, including the ones whose radius is invisible until they are focused. A
native radio is the awkward case: Chrome keeps its own widget geometry at
`appearance: auto` and drops an author radius with it, so the control is drawn
by hand — an empty ink ring that fills when chosen, which is the legend a field
mark already uses. Where the real control is `sr-only`, the label it sits in
wears the ring instead.

Hairlines are `1px solid var(--rule)`. There are no shadows anywhere. Depth
is expressed by `--paper-sunk`, never by a blur.

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
  the sidebar brand row, the agent panel header, the sign-in column and the
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

A **field** is a state, and it is worn as a mark. Nothing else.

It used to be a surface too — a whole card, a whole heading, a whole panel body
tinted by how resolved the thing under it was. That is gone, and this is the
single most important line in this document, because every screen that read as
decorated read that way for the same reason:

> **Grey behind a paragraph is a background.** A background is read as a
> background — as chrome, as decoration, as something the page is sitting on —
> however carefully it was chosen and whatever it was meant to encode.

The surface also spent its whole life competing with the text on top of it,
which is why every rule about it was really a rule about contrast. That is what
a device in the wrong place looks like. The mark says the same thing in a
twelfth of the area, on the object that has the state, with the state named in
words beside it.

**A field mark — `.grain-mark`.** 12px, fully round, one flat fill, no
geometry, no text. As many per screen as there are objects with a state: a
concept row, a subject heading, a panel, an agent thinking beside a line of
status text. Identical to each other, so a column of them reads as a legend.

Fill and grain are **one axis, not two**. A mark is painted by one state class,
and that class moves both:

| Class | Grain | Fill | Means |
| --- | --- | --- | --- |
| `.field-unresolved` | `--grain-3` | filled | Unattempted, unknown, or an agent still working |
| `.field-partial` | `--grain-2` | half | Under way |
| `.field-settled` | `--grain-0` | empty ring | Mastered. Settled. |

`src/lib/mastery.js` is the only place the pairing is written down. A component
reads `grain` and `field` from `masteryState()` rather than choosing either
itself, so the interface cannot say one thing with its texture and another with
its fill.

`.field-settled` empties out rather than fading. An arrival is the *absence* of
the fill, and the ring is what keeps it from looking like a missing element.

### Where a mark goes

1. On the object whose state it is — a concept, a queue item, a panel, an
   agent.
2. Beside a word that names the same state. **A mark is never the only carrier
   of meaning**: 12px of grey says nothing to a screen reader, nothing at a
   glance across a room, and nothing to anyone who is not already looking for
   it. The words do the work; the mark makes the column scannable.
3. Nowhere else. There is no second form to reach for.

**Never as a background.** Not behind a heading, not behind a paragraph, not
behind a table, not under a form, not as a panel body, not as a page-wide band,
not as a button fill. `globals.css.test.js` fails if `.grain-field` or
`.grain-wash` is defined in the stylesheet or named in any component, which is
the only way a rule like this survives contact with a deadline.

Some screens carry no mark at all. Settings has no state worth encoding, an
empty course list says it is empty in words, and a 404 page says so in a
heading. Inventing a state for those is exactly the decoration this document
exists to prevent.

### Text and marks

Text sits on paper. That is the whole rule now, and it is the one good thing to
come out of removing the surface: `--ink-muted` keeps its 7:1 everywhere,
`--ink` keeps its 21:1 everywhere, and no component has to reason about what it
is being read on top of. `--ink-faint` still never carries text of any size.

A mark holds no text, so nothing is ever set on a fill. `globals.css.test.js`
fails on a `.grain-mark` element with a text child.

### Rules

- **A field is a mark.** If what you are reaching for is bigger than 12px, it
  is a background, and the answer is a word instead.
- **Never alone.** A mark always sits beside the word that names its state.
- **Grain and fill are state, never mood.** If you cannot name the state they
  encode, delete them.
- **Never both by hand.** A mark's fill and its grain always come from
  `masteryState()`. Setting `--grain` next to a mismatched `.field-*` class is
  the one way left to make the signature lie.


## Motion

Motion is named. That is the rule, and it is a different rule from the one
this section used to carry.

This document said motion was rare and allowed two movements, the settle and
the drift, and forbade everything else by name. Rarity turned out to be the
wrong constraint. A flashcard that changes its face without turning is a
substitution, not a card; a panel that appears where nothing was is a jump
cut; a list that materialises whole gives the eye no order to read it in. Each
of those is a place where the interface knows something about what just
happened and refuses to say it. The prohibition was not keeping the product
quiet, it was making it abrupt.

So the catalogue grows and the discipline moves. Every movement has a name, a
duration, a curve and a reason, and it is written down once in
`src/app/globals.css` as a token and a utility class. A component that needs
movement reaches for one of these. A component that invents an eighth timing
is the thing this section exists to prevent.

| Movement | Where | Spec |
| --- | --- | --- |
| **Settle** | An answer lands, a concept resolves | 600ms `cubic-bezier(0.16, 1, 0.3, 1)` |
| **Drift** | The agent is working | 8s loop |
| **Stagger** | A list appears | 40ms offset, at most 6 items, then all at once |
| **Flip** | A flashcard turns | 300ms, 3D, `ease-out` |
| **Slide** | A panel or a type changes | 200ms `ease-out` on transform |
| **Lift** | Hover on an interactive surface | 120ms, 1px rise, hairline darkens |
| **Count** | A number changes | 400ms, monospace, no easing bounce |

**The settle** is still the only animation anyone should remember. When an
agent finishes, or a learner picks a concept they have already mastered, its
mark travels to the new state — grain and fill together, the ink draining out
of it as the noise clears. `--field-mark` is registered with `@property` so
the fill can interpolate; without that the mark would jump.

**The drift** translates the grain layer by a few pixels while an agent works.
Slow enough to be felt, not watched.

**The stagger** stops at six because past six the offset stops reading as
arrival and starts reading as the page being slow. Items seven onward land
with the sixth. Six times 40ms is 240ms, which is under the quarter second at
which a delay becomes a wait.

**The flip** is the only movement allowed a third dimension, and it gets one
because a card with two faces is a real object a learner already understands.
Nothing else in the product may rotate in depth.

**The slide** moves a transform and never a width, a height or a position.
Animating layout re-flows the page on every frame, and the text inside reflows
while it is being read.

**The lift** answers one question — is this a control? — and answers nothing
else. One pixel and a darker hairline. It does not grow, it does not shadow
(there are no shadows, see [Shape](#shape)), and it does not change the ink of
the label.

**The count** is monospace so the digits do not shuffle sideways as they move,
and linear so the value reads as counted rather than as thrown.

### What is still forbidden

- **Bounce and spring.** Overshoot says "look at me" about a thing the learner
  already asked for.
- **Parallax.** It claims the page has a depth it does not have, and it makes
  a reading column move at a different speed from the thing it is about.
- **Autoplay.** Anything that starts moving without being asked takes the
  decision away from the learner, including video, carousels and looping
  demonstrations. The drift is the exception, and it is the exception because
  it reports that the agent is busy right now.
- **Any movement carrying information nothing else carries.** If removing the
  animation loses the meaning, the meaning was never in the interface — it was
  in the transition, where a screen reader, a still screenshot and a reduced
  motion setting all miss it. Say it in words first, then move.

### Reduced motion

`prefers-reduced-motion: reduce` removes **all** of it. Not a faster version,
not a fainter one: the drift stops, the settle becomes an instant state
change, and every class in the catalogue drops its transition. This is cheap
to honour precisely because of the rule above — every movement here decorates
a state change that has already happened, so the list is still there, the card
is still turned and the number still reads its new value.

## Interaction floor

Not optional, not announced:

- Focus is a `2px solid var(--ink)` outline at `2px` offset, visible on every
  focusable element, and **round**, because the outline takes the element's own
  corner — see [Shape](#shape). Never `outline: none` without a replacement.
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

- Does anything paint a background? Anything at all behind text — a tint, a
  wash, a gradient — is wrong before you finish reading this line.
- Does every mark encode a real state, on the object that has it, beside a word
  that names it?
- Does it carry a `.field-*` class? A mark without one paints nothing.
- Does anything use colour at all, other than the one mark? Remove it.
- Is any text on a field muted rather than ink?
- Is the reading column at or under 66 characters?
- Does every focusable element show its focus ring, and is that ring round?
- Does it hold together at 360px?
- Chanel's rule: take one thing off.
