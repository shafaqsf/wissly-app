/* One field over everything.

   A plain GET form, and that is the design rather than the shortcut. Search
   is a reflex: it costs one Postgres full text query and no model call, the
   result is a URL that can be bookmarked and shared, and it works before any
   JavaScript has loaded. Nothing here needs to be a client component.

   The label is real. A placeholder is not a label — it disappears the moment
   the learner starts typing, which is exactly when it was doing its job. */
export default function SearchField({ query = '', subjectId = null, autoFocus = false }) {
  return (
    <form role="search" action="/search" method="get" className="flex items-center gap-3">
      <label htmlFor="search-query" className="font-mono text-label uppercase text-ink-muted">
        Search
      </label>
      <input
        id="search-query"
        name="q"
        type="search"
        defaultValue={query}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder="A phrase you remember"
        className="min-h-11 flex-1 rounded-control border border-rule bg-paper px-4 text-body"
      />
      {/* The course scope travels with the query rather than being re-picked,
          so a scoped search stays scoped when it is refined. */}
      {subjectId ? <input type="hidden" name="course" value={subjectId} /> : null}
      <button
        type="submit"
        className="motion-lift inline-flex min-h-11 items-center rounded-control border border-rule px-4 font-mono text-label uppercase"
      >
        Search
      </button>
    </form>
  );
}
