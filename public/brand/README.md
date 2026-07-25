# brand

**The mark does not live here. It lives at `src/app/icon.png`.**

That is a Next.js metadata file convention, and it is the reason for the move:
Next emits the `<link rel="icon">` tags itself and puts a content hash in the
URL. A plain path under `/public` gets none, and browsers cache a favicon per
origin — so a `localhost` port that once served a different icon goes on
serving it no matter what the markup says.

One file serves both jobs. `src/components/brand/brand-mark.jsx` imports the
same PNG for the places the mark appears inside the app, so there is no second
copy to forget. A test in `src/app/globals.css.test.js` fails if any other file
imports it.

To replace the mark, replace `src/app/icon.png`. Keep it square, keep the
background transparent, and keep it drawn from the field palette — see
"The mark" in [`docs/DESIGN.md`](../../docs/DESIGN.md) for why that last part
is not cosmetic.

This directory is kept only for this note.
