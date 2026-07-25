# brand

`icon.png` is the wissly mark: 500×500, RGBA, transparent background. One file
serves the browser tab and the agent.

Nothing else may reach it directly. `src/components/brand/brand-mark.jsx` owns
the path and exports `MARK`; the root layout points `metadata.icons` at that
export, and the agent panel composes the component. A test in
`src/app/globals.css.test.js` fails if any other file names the asset.

The mark is the one coloured thing in the product — a named exception to the
no-colour-in-the-chrome rule, not a loophole. See "The mark" in
[`docs/DESIGN.md`](../../docs/DESIGN.md) for why it earns that, and for what
must not follow it.

Replacing the mark means replacing this file. Keep it square, keep the
background transparent, and keep it drawn from the field palette — a mark in
some other hue would make the exception arbitrary.
