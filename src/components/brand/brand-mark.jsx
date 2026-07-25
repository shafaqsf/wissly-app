import Image from 'next/image';

// `src/app/icon.png` is a Next.js metadata file convention: placing the mark
// there is what makes it the browser tab icon, and Next emits the <link> tags
// itself with a content hash in the URL. The hash matters — a plain path under
// /public is cached by the browser per origin, so a localhost port that once
// served a different icon goes on serving it.
//
// Importing the same file here is what keeps the tab and the app on one asset.
// Replace that file and both follow; there is no second copy to forget.
import mark from '@/app/icon.png';

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

export const MARK = mark;

export default function BrandMark({ size = 20 }) {
  return (
    <Image
      data-brand-mark=""
      src={mark}
      width={size}
      height={size}
      // Decorative everywhere it is used: the mark sits beside the product's
      // name in words, and a screen reader gains nothing by hearing it twice.
      alt=""
      priority={false}
    />
  );
}
