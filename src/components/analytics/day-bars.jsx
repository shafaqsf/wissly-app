/* A frequency histogram, in hairlines.

   This is not a progress bar and the distinction is not pedantry. A progress
   bar says how far along one thing is, out of a whole — that is the display
   this product does without, because progress in wissly is grain and depth. This
   says how often something happened on each of seven days. It has no whole to
   be a fraction of, so there is no percentage to show and none is shown.

   No streak either. How often you turned up is a fact; a streak is a
   judgement about it, and the moment it exists the interface starts asking to
   be kept happy. */

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

function readDay(date) {
  return DAY_FORMAT.format(new Date(`${date}T00:00:00.000Z`));
}

function countInWords(value, unit) {
  if (!value) return `no ${unit}s`;
  return `${value} ${value === 1 ? unit : `${unit}s`}`;
}

/**
 * @param {object} props
 * @param {string} props.label what the bars are of — the accessible name
 * @param {Array<{date: string, value: number}>} props.days oldest first
 * @param {string} props.unit the noun a value is counted in
 * @param {(value: number) => string} [props.format] for values that are not counts
 */
export default function DayBars({ label, days = [], unit = 'review', format }) {
  const peak = Math.max(0, ...days.map((day) => Number(day.value) || 0));

  return (
    <ul
      aria-label={label}
      // Six days plus today is seven columns, and the stagger caps at six, so
      // the last two land together. That is the rule, not an oversight.
      className="motion-stagger flex items-end gap-2"
    >
      {days.map((day) => {
        const value = Number(day.value) || 0;
        // A bar of zero would be nothing at all, so an empty day keeps its
        // baseline hairline. An absent day and a day with no reviews are
        // different facts and must not look the same.
        const height = peak > 0 ? `${Math.round((value / peak) * 100)}%` : '0%';

        return (
          <li key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="flex h-16 w-full items-end justify-center" aria-hidden="true">
              <span
                data-testid="day-bar"
                className="w-px bg-ink"
                style={{ height }}
              />
            </span>
            {/* The baseline, so a day with nothing on it still reads as a day
                rather than as a hole in the chart. */}
            <span className="w-full border-t border-rule" aria-hidden="true" />
            <span className="sr-only">
              {readDay(day.date)}: {format ? format(value) : countInWords(value, unit)}
            </span>
            <span aria-hidden="true" className="font-mono text-caption text-ink-muted">
              {day.date.slice(8)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
