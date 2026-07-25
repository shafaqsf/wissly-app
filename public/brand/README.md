# brand

Drop the wissly mark here. One source file serves both the favicon and the
agent avatar.

| File | Purpose | Notes |
| --- | --- | --- |
| `icon.svg` | Preferred source. Favicon and agent avatar. | Monochrome, `currentColor` where possible, square viewBox, no padding baked in. |
| `icon.png` | Fallback if SVG is not available. | 512×512, transparent background. |

Nothing here is wired up yet — once a file lands, the layout picks it up as
the favicon and the agent uses it as its avatar.

Per [`docs/DESIGN.md`](../../docs/DESIGN.md) the mark is ink on paper: no
colour, no gradient. Colour lives only inside a grain field.
