import Link from 'next/link';

export const metadata = {
  title: 'Not found — wissly',
};

/* The root not-found handles every URL that matches no route, so it renders
   outside the dashboard frame — there is no sidebar here to lean on, which is
   why it says where it is and offers exactly one way on.

   A page that is not there is an empty state, which is one of the three
   places a grainy gradient is allowed. It stays at --grain-2: there is body
   text on it. */
export default function NotFound() {
  return (
    <div
      className="grain grain-field field-unresolved flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center"
    >
      <p className="font-mono text-label uppercase text-ink-muted">404</p>
      <h1 className="font-display text-display-l font-bold">
        This page is not here
      </h1>
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
