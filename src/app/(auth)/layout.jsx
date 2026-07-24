/* The auth screens share one frame: a single narrow column on clean paper.
   No grain field — docs/DESIGN.md keeps grainy gradients away from forms,
   and there is no state here for grain to encode. */
export default function AuthLayout({ children }) {
  return (
    <main className="flex flex-1 flex-col justify-center px-6 py-16">
      <div className="mx-auto flex w-full max-w-[42ch] flex-col gap-8">{children}</div>
    </main>
  );
}
