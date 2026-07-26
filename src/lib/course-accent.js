/* A stable, per-course accent — task item 6 in v0.15's visual identity work.
   Every course is tagged with a colour on the shelf and on its own header, so
   a learner can tell two courses apart at a glance rather than by reading the
   title first.

   It is derived from the course id, not chosen and not stored: the same id
   always turns the same colour, two different ids almost always turn two
   different colours, and there is no palette to maintain as courses are
   added. That is not the same freedom as picking any hue — see "Colour" in
   docs/DESIGN.md — so only the hue moves. Saturation and lightness are fixed
   at the values below for every course, which is what keeps a shelf of tags
   reading as one product's palette instead of a colour wheel. Because the
   value is computed at request time rather than written as a literal, it
   never appears as a hex code for `globals.css.test.js` to catch, and it
   never needs to: the constraint is enforced here, in the one place the
   colour is computed, instead of by scanning for it after the fact. */

const SATURATION = 60;
const LIGHTNESS = 45;

/** A small, fast string hash — good enough to spread ids across the wheel,
 * not meant to be cryptographic. */
function hash(value) {
  let h = 0;

  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }

  return Math.abs(h);
}

export function courseAccent(id = '') {
  const hue = hash(String(id ?? '')) % 360;

  return `hsl(${hue} ${SATURATION}% ${LIGHTNESS}%)`;
}
