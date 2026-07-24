/* A panel is a frame, not a feature. It knows a title, an optional action and
   three ways its content can turn out — present, empty, or failed. It knows
   nothing about what it holds, which is what lets a new panel be one line. */
export default function Panel({
  title,
  action,
  empty,
  error,
  wide = false,
  grain = false,
  children,
}) {
  const state = error ? 'error' : empty ? 'empty' : 'content';

  // A surface with nothing on it yet is, definitionally, unresolved — one of
  // the three places DESIGN.md allows a grainy gradient. It is opt-in because
  // only one such field may appear per viewport, and a panel cannot know what
  // the panels beside it are doing. Reviewing the page is what enforces it.
  const field = grain && state === 'empty';

  return (
    <section
      aria-label={title}
      data-state={state}
      className={[
        'flex flex-col border border-rule bg-paper',
        // No colour carries the failure. A 2px ink rule on the left does, and
        // nothing else in the interface has one.
        error ? 'border-l-2 border-l-ink' : '',
        wide ? 'md:col-span-2' : '',
      ].join(' ')}
    >
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-rule px-5">
        <h2 className="font-display text-title font-semibold">{title}</h2>
        {action}
      </header>

      <div
        className={[
          'flex-1 px-5 py-5',
          field ? 'grain grain-field field-partial min-h-40' : '',
        ].join(' ')}
        style={field ? { '--grain': 'var(--grain-2)' } : undefined}
      >
        {error ? (
          <p role="alert" className="text-body-s text-ink">
            {error}
          </p>
        ) : empty ? (
          // Muted ink is a 7:1 contrast on paper and less than that on a
          // tinted field. Inside a field the copy is full ink; outside it
          // stays secondary, because there it is.
          <p className={field ? 'text-body-s text-ink' : 'text-body-s text-ink-muted'}>
            {empty}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
