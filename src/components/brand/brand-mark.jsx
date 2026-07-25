import Image from 'next/image';

/* The wissly mark: the one coloured thing in the product.

   docs/DESIGN.md keeps hue out of the chrome so that colour inside a field
   stays a signal. The mark is the named exception, and it earns that on the
   same grounds the rule exists: it is drawn from the field palette and it is
   grained. Heat at its edges, depth behind it, a cool core — the same axis the
   grain describes, standing still. It is not an icon in the Lucide sense and
   it is never treated as one: it is never recoloured, never given a state,
   never used to carry meaning a word is not already carrying beside it.

   `globals.css.test.js` holds the exception to this one file, so composing
   this component is the only way to reach the asset. */

export const MARK = '/brand/icon.png';

export default function BrandMark({ size = 20 }) {
  return (
    <Image
      data-brand-mark=""
      src={MARK}
      width={size}
      height={size}
      // Decorative everywhere it is used: the mark sits beside the product's
      // name in words, and a screen reader gains nothing by hearing it twice.
      alt=""
      priority={false}
    />
  );
}
