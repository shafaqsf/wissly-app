/* The auth screens are one centred reading column with the mark above it.

   There used to be a field here: first the whole right half of the viewport,
   then a 128px band above the column, encoding "signed out" as the most
   unresolved the product ever gets. It was a grey box with a logo in it. The
   page it sits on is titled "Sign in" — nothing about the state was ever in
   doubt, and the tint was the only thing on the screen that was decoration. */
import BrandMark from '@/components/brand/brand-mark';

export default function AuthLayout({ children }) {
  return (
    <main className="flex flex-1 flex-col justify-center px-6 py-16">
      <div className="mx-auto flex w-full max-w-[42ch] flex-col gap-8">
        {/* There is no sidebar out here to say which product this is, so the
            mark says it. Decorative — the words below name the product too. */}
        <div aria-hidden="true" className="flex justify-center">
          <BrandMark size={64} />
        </div>

        {children}
      </div>
    </main>
  );
}
