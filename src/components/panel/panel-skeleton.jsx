/* The loading state of a panel. Three bars where the content will be, and
   `aria-busy` for anyone who is not looking at them.

   The body used to be a grey wash at `--grain-3`. Several panels load at once,
   so several grey slabs appeared at once, and a wall of grey is the loudest
   thing a screen can do to say "not yet". The bars already say it. */
export default function PanelSkeleton({ title, wide = false }) {
  return (
    <section
      aria-label={title}
      aria-busy="true"
      className={[
        'flex flex-col overflow-hidden rounded-surface border border-rule bg-paper',
        wide ? 'md:col-span-2' : '',
      ].join(' ')}
    >
      <header className="flex min-h-14 items-center border-b border-rule px-5">
        <h2 className="font-display text-title font-semibold text-ink-muted">
          {title}
        </h2>
      </header>

      <div className="flex-1 px-5 py-5">
        {/* Rounded like everything else that is a surface rather than a page
            edge. Square bars were the one place the shape system broke. */}
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-3 w-2/3 rounded-round bg-rule" />
          <div className="h-3 w-full rounded-round bg-rule" />
          <div className="h-3 w-1/2 rounded-round bg-rule" />
        </div>
      </div>
    </section>
  );
}
