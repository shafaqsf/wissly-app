/* A panel is a frame, not a feature. It knows a title, an optional action and
   three ways its content can turn out — present, empty, or failed. It knows
   nothing about what it holds, which is what lets a new panel be one line. */
export default function Panel({ title, action, empty, error, wide = false, mark, children }) {
  const state = error ? 'error' : empty ? 'empty' : 'content';

  return (
    <section
      aria-label={title}
      data-state={state}
      className={[
        // `overflow-hidden` so anything the panel holds is clipped to the same
        // corner the border draws.
        'flex flex-col overflow-hidden rounded-surface border border-rule bg-paper',
        wide ? 'md:col-span-2' : '',
      ].join(' ')}
    >
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-rule px-5">
        <h2 className="font-display text-title font-semibold">{title}</h2>
        {mark ? (
          // A mark, not a field: the state belongs to this panel, and a panel
          // is not large enough to carry a radial surface without the surface
          // becoming the panel. The label is what a screen reader hears and
          // what anyone who cannot separate three tints reads.
          <p className="flex items-center gap-2 font-mono text-caption text-ink-muted">
            <span
              aria-hidden="true"
              className={`grain grain-mark ${mark.field}`}
              style={{ '--grain': mark.grain }}
            />
            {mark.label}
          </p>
        ) : null}
        {action}
      </header>

      {/* An empty panel used to take a tinted field here, on the grounds that
          a surface with nothing on it is unresolved. It was a grey rectangle
          under a sentence. If a panel's emptiness is a state worth showing, it
          wears a `mark` in its header like every other state does. */}
      <div className="flex-1 px-5 py-5">
        {error ? (
          // No colour carries the failure. A 2px ink rule does, and nothing
          // else in the interface has one. It rules the message rather than
          // the frame: a 2px side on a 14px corner mitres into the 1px
          // hairline and the panel stops looking round at both ends of it.
          <p role="alert" className="border-l-2 border-l-ink pl-4 text-body-s text-ink">
            {error}
          </p>
        ) : empty ? (
          // `empty` is usually a sentence and gets wrapped here. A caller
          // that has more to say — task item 7 in v0.15, an illustrated
          // `EmptyState` — passes an element instead, and composes its own
          // secondary-ink paragraph, so it is rendered as given rather than
          // nested inside a second one.
          typeof empty === 'string' ? (
            <p className="text-body-s text-ink-muted">{empty}</p>
          ) : (
            empty
          )
        ) : (
          children
        )}
      </div>
    </section>
  );
}
