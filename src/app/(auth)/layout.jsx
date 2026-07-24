/* The auth screens share one frame: a narrow reading column beside a field.

   The field sits *next to* the form, never behind it — docs/DESIGN.md keeps
   colour and grain off any surface a learner has to read and type on. On a
   phone there is no beside, so it becomes a band above.

   What it encodes: signed out is the one state in which the platform knows
   nothing about you at all. It is the most unresolved the product ever gets,
   and it is the only field carrying an account state rather than a knowledge
   state. */
export default function AuthLayout({ children }) {
  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <div
        aria-hidden="true"
        className="grain grain-field field-unresolved min-h-32 shrink-0 md:order-last md:min-h-full md:flex-1"
        style={{ '--grain': 'var(--grain-3)' }}
      />

      <div className="flex flex-1 flex-col justify-center px-6 py-16">
        <div className="mx-auto flex w-full max-w-[42ch] flex-col gap-8">
          {children}
        </div>
      </div>
    </main>
  );
}
