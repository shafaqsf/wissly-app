import SearchField from '@/components/search/search-field';
import SearchResults from '@/components/search/search-results';
import { search } from '@/lib/data/search';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Search — wissly',
};

/* One field over sources, sections, concepts, tasks, reading and
   conversations, and one Postgres full text query behind it.

   Searching is a reflex, not a question. It costs no model call, it is a GET
   so the result is a URL, and an empty query asks the database nothing at all
   rather than pulling the whole library back to show none of it.

   No grain here. Nothing on this page has a state — a hit is a hit — and
   inventing one would be exactly the decoration this product exists
   without. */
export default async function SearchPage({ searchParams }) {
  const params = (await searchParams) ?? {};
  const query = String(params.q ?? '').trim();
  const subjectId = params.course || undefined;

  let results = [];
  let error = null;

  if (query !== '') {
    try {
      const supabase = await createClient();
      results = await search(supabase, { query, subjectId });
    } catch (cause) {
      // The learner reads this. It says what happened and what to do next,
      // and it is ruled rather than coloured — there is no red here.
      error = cause?.message ?? 'Could not search your material. Try again.';
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">Everything you have</p>
        <h1 className="font-display text-display-l font-bold">Search</h1>
      </header>

      <SearchField query={query} subjectId={subjectId ?? null} autoFocus />

      {error ? (
        <p role="alert" className="max-w-measure border-l-2 border-l-ink pl-4 text-body-s text-ink">
          {error}
        </p>
      ) : (
        <>
          {query === '' ? null : (
            <p className="font-mono text-caption uppercase text-ink-muted">
              {results.length === 1 ? '1 result' : `${results.length} results`}
            </p>
          )}
          <SearchResults query={query} results={results} />
        </>
      )}
    </div>
  );
}
