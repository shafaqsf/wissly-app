import Image from 'next/image';

/* The wissly mark: the one coloured thing in the product.

   Hue stays out of the product entirely — a field is ink at a
   dilution, and nothing on a page carries a colour. The mark is the single
   named exception, and it is exactly one object rather than a licence: hue
   here means "this is wissly" and never anything else. It is not an icon in
   the Lucide sense and it is never treated as one: it is never recoloured, never given a state,
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
