import Link from 'next/link';

import BrandMark from '@/components/brand/brand-mark';

export const metadata = {
  title: 'Not found — wissly',
};

/* The root not-found handles every URL that matches no route, so it renders
   outside the dashboard frame — there is no sidebar here to lean on, which is
   why it says where it is and offers exactly one way on.

   The card used to be tinted, on the grounds that a page that is not there is
   an empty state. It was a grey box behind a heading, which is a background —
   and the heading already says the whole thing. */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="flex flex-col items-center gap-3 rounded-surface border border-rule px-8 py-10">
        {/* This page renders outside the dashboard frame, so there is no
            sidebar here to say which product the learner is lost in. */}
        <BrandMark size={40} />
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
