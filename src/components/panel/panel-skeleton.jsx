/* The loading state of a panel. Grain at `--grain-3` says the same thing here
   that it says everywhere else: this is not resolved yet. When the real panel
   replaces it, the page settles to `--grain-1`.

   Flat grain, no radial gradient — several panels can load at once, and
   several gradient fields would read as texture instead of as signal. */
export default function PanelSkeleton({ title, wide = false }) {
  return (
    <section
      aria-label={title}
      aria-busy="true"
      className={[
        'flex flex-col border border-rule bg-paper',
        wide ? 'md:col-span-2' : '',
      ].join(' ')}
    >
      <header className="flex min-h-14 items-center border-b border-rule px-5">
        <h2 className="font-display text-title font-semibold text-ink-muted">
          {title}
        </h2>
      </header>

      <div
        className="grain grain-working flex-1 bg-paper-sunk px-5 py-5"
        style={{ '--grain': 'var(--grain-3)' }}
      >
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-3 w-2/3 bg-rule" />
          <div className="h-3 w-full bg-rule" />
          <div className="h-3 w-1/2 bg-rule" />
        </div>
      </div>
    </section>
  );
}
