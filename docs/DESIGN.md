# Design

The visual language of wissly. Binding for every screen. Where this document
and a mockup disagree, this document wins.

## The one idea

wissly is a learning platform. Learning is the movement from noise to signal —
from a subject you cannot yet resolve to one you can.

**So grain is not decoration here. Grain is the measure of what is not yet
known.** A topic you have never touched is heavily grained. A topic you have
mastered is clean paper. An agent that is still thinking sits in a drifting
grainy field; when it answers, the field settles.

Everything else on the page is quiet so that this one device can carry meaning.
If a grain effect on a screen does not encode state, remove it.

## Colour

There is no colour. Ink on paper, and the greys between them.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#FFFFFF` | Page background. The default surface. |
| `--paper-sunk` | `#F4F4F4` | Recessed surfaces, grain fields, code blocks |
| `--rule` | `#E4E4E4` | Hairlines, borders, dividers |
| `--ink-faint` | `#9A9A9A` | **Non-text only.** Disabled marks, chart gridlines |
| `--ink-muted` | `#5C5C5C` | Secondary text, captions, metadata |
| `--ink` | `#000000` | Body text, headings, icons, focus rings |

Contrast against `--paper`: `--ink` 21:1, `--ink-muted` 7.0:1, `--ink-faint`
2.8:1. `--ink-faint` therefore never carries text of any size.

### No dark mode

The identity is black on white. A dark inversion would break the grain
metaphor — noise on black reads as static, not as uncertainty. Do not add a
`prefers-color-scheme: dark` block.

### No status colours

No red for errors, no green for success. Status is carried by three things
that work without hue:

- **Words.** "Lesson not saved. Check your connection and try again."
- **An icon**, monochrome, from the same set as everything else.
- **A rule.** A destructive or failed surface gets a 2px solid `--ink` left
  border. Nothing else on the page has one, so it reads instantly.

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

- `--radius: 4px` on controls: buttons, inputs, chips.
- `0` on structural surfaces: cards, panels, grain fields, dividers.
- Fully round only on avatars and count badges.

Hairlines are `1px solid var(--rule)`. There are no shadows anywhere. Depth
is expressed by `--paper-sunk` and by grain, never by a blur.

## Icons

[Lucide](https://lucide.dev), and nothing else.

- 24px grid, 1.5px stroke, `stroke="currentColor"`, never filled.
- Monochrome. An icon inherits the ink colour of its context.
- Never the only carrier of meaning. Every icon-only control has an
  `aria-label`, and any icon that conveys state sits beside text.
- Do not mix in another icon set, do not recolour, do not add a gradient.

## Grain

The signature. One implementation, four intensities.

### Source

An SVG `feTurbulence`, inlined as a data URI so it costs no request and
scales without artefacts:

```
<svg xmlns="http://www.w3.org/2000/svg">
  <filter id="g">
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#g)"/>
</svg>
```

Applied on a `::before` pseudo-element with `mix-blend-mode: multiply` and
`pointer-events: none`, so it never intercepts a click.

### Intensities

| Token | Opacity | Means |
| --- | --- | --- |
| `--grain-0` | 0 | Mastered. Settled. Nothing left to resolve. |
| `--grain-1` | 0.035 | Ambient. The page itself. |
| `--grain-2` | 0.07 | In progress. Partially learned. |
| `--grain-3` | 0.14 | Unattempted, unknown, or an agent still working. |

### Grainy gradients

A grainy gradient is a radial gradient from `--paper-sunk` at its focus to
`--paper` at its edge, with a grain layer on top. It is reserved for exactly
three places:

1. The hero field on the landing page.
2. The agent's working state.
3. Empty states — a surface that has nothing on it yet is, definitionally,
   unresolved.

Never behind a form. Never behind a table. Never as a button fill.

### Rules

- **Grain never sits under body text above `--grain-2`.** Contrast is not
  negotiable against atmosphere.
- **One grain field per viewport.** Two competing fields read as a texture
  pack, not as a signal.
- **Grain is state, never mood.** If you cannot name the state it encodes,
  delete it.

## Motion

Motion is rare and it is functional.

- **The settle.** When an agent finishes, its field moves `--grain-3` →
  `--grain-1` over 600ms, `cubic-bezier(0.16, 1, 0.3, 1)`. This is the only
  animation anyone should remember.
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

- Is there exactly one grain field, and does it encode a real state?
- Does anything use colour? Remove it.
- Is the reading column at or under 66 characters?
- Does every focusable element show its focus ring?
- Does it hold together at 360px?
- Chanel's rule: take one thing off.
