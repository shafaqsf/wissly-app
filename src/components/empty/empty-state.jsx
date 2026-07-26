import { ILLUSTRATIONS } from './illustrations';

/* An empty list, illustrated — task item 7 in v0.15. The words still do the
   work: "Empty states are an invitation to act, not an apology for
   emptiness" (see "Writing" in docs/DESIGN.md), and every caller still writes
   the sentence that says what to do next. This only adds a small picture
   beside it, the way a mark sits beside a word rather than instead of one.

   `variant` picks which of the four illustrations in `illustrations.jsx` to
   draw; there is no default because every call site should say which one it
   means. */
export default function EmptyState({ variant, action, children }) {
  const Illustration = ILLUSTRATIONS[variant];

  return (
    <div className="flex flex-col items-start gap-4">
      {Illustration ? (
        <Illustration data-empty-illustration="" />
      ) : null}
      <p className="max-w-measure text-body-s text-ink-muted">{children}</p>
      {action}
    </div>
  );
}
