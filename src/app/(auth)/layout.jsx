/* The auth screens are one centred reading column with a field above it.

   The field used to be the whole right half of the viewport. That is a field
   describing a screen, and a screen has no state — docs/DESIGN.md now sizes a
   field to the object whose state it carries. Here that object is the account,
   so the field is the width of the column the account is created in.

   Above the form, never behind or below it: colour and grain stay off any
   surface a learner has to read and type on.

   What it encodes: signed out is the one state in which the platform knows
   nothing about you at all. It is the most unresolved the product ever gets,
   and it is the only field carrying an account state rather than a knowledge
   state. */
export default function AuthLayout({ children }) {
  return (
    <main className="flex flex-1 flex-col justify-center px-6 py-16">
      <div className="mx-auto flex w-full max-w-[42ch] flex-col gap-8">
        <div
          aria-hidden="true"
          className="grain grain-field field-unresolved h-28 rounded-surface"
          style={{ '--grain': 'var(--grain-3)' }}
        />

        {children}
      </div>
    </main>
  );
}
