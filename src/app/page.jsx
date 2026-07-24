export default function Home() {
  return (
    <main
      className="grain grain-field flex flex-1 flex-col justify-center px-6 py-24"
      style={{ "--grain": "var(--grain-2)" }}
    >
      <div className="mx-auto flex w-full max-w-[66ch] flex-col gap-6">
        <p className="font-mono text-label text-ink-muted uppercase">
          Open source
        </p>

        <h1 className="font-display text-display-xl font-extrabold">wissly</h1>

        <p className="text-title text-ink-muted">
          An agentic learning platform. Learning is the move from noise to
          signal — this interface says so with its own grain.
        </p>

        <p className="text-body-s text-ink-muted border-rule border-t pt-6">
          Under construction. The foundation is in place; the platform is not
          built yet.
        </p>
      </div>
    </main>
  );
}
