import Link from 'next/link';

export const metadata = {
  title: 'Not found — wissly',
};

/* The root not-found handles every URL that matches no route, so it renders
   outside the dashboard frame — there is no sidebar here to lean on, which is
   why it says where it is and offers exactly one way on.

   A page that is not there is an empty state, which is one of the places a
   grainy gradient is allowed. The field is the card the heading sits in, not
   the viewport: a viewport-wide field describes the browser window, and the
   browser window has no state. Body copy stays on clean paper beside it, which
   is what lets the card run at the full unresolved intensity. */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div
        className="grain grain-field field-unresolved flex flex-col items-center gap-3 rounded-surface px-8 py-10"
        style={{ '--grain': 'var(--grain-3)' }}
      >
        <p className="font-mono text-label uppercase text-ink">404</p>
        <h1 className="font-display text-display-l font-bold">
          This page is not here
        </h1>
      </div>

      <p className="max-w-measure text-body">
        The address you followed does not belong to anything in wissly. It may
        have been a typo, or something that has since moved.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center rounded-control border border-rule px-4 font-mono text-label uppercase text-ink"
      >
        Go to your dashboard
      </Link>
    </div>
  );
}
