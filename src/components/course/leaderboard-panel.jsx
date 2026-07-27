/* Ranking numbers are the one place this product shows a raw count: the
   maintainer-approved exception to "no progress bar, no percentage
   anywhere" covers a leaderboard's rank and its review count, and nothing
   else on this panel. Mastery elsewhere on the page is still a mark, never
   a number — this panel does not touch that.

   No email, no name: the leaderboard has no source for either (the
   database never hands a member's email to anyone but the owner who typed
   it, see share-panel.jsx), so a fellow member is labelled by a short,
   stable fragment of their id — enough to tell rows apart across a
   session, never enough to identify anyone from it alone. */

function label(memberId, currentUserId) {
  if (memberId === currentUserId) return 'You';
  return `Member ${memberId.slice(0, 4)}`;
}

export default function LeaderboardPanel({ rows = [], currentUserId }) {
  return (
    <ol className="motion-stagger flex flex-col gap-2">
      {rows.map((row) => (
        <li
          key={row.memberId}
          className="flex min-h-11 items-center justify-between gap-4 rounded-control border border-rule px-4 py-3"
        >
          <span className="flex items-center gap-3">
            <span className="font-mono text-label text-ink-muted">#{row.rank}</span>
            <span className="text-body-s">{label(row.memberId, currentUserId)}</span>
          </span>
          <span className="font-mono text-caption uppercase text-ink-muted">
            {row.reviewsThisWeek} {row.reviewsThisWeek === 1 ? 'review' : 'reviews'}
          </span>
        </li>
      ))}
    </ol>
  );
}
