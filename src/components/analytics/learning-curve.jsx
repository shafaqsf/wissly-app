/* A line, not a bar. `day-bars.jsx` draws a frequency histogram — how often
   something happened — which has no whole to be a fraction of, so it shows
   no percentage. A learning curve answers the other question, how well, and
   "how well" only means something as a real number. This is one of the
   analytics surfaces the maintainer has scoped the no-percentage rule
   around; the mastery mark everywhere else in the product is untouched. */

const WIDTH = 480;
const HEIGHT = 120;
const PAD = 10;

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

function readDay(date) {
  return DAY_FORMAT.format(new Date(`${date}T00:00:00.000Z`));
}

function percent(recall) {
  return `${Math.round(recall * 100)}%`;
}

/**
 * @param {object} props
 * @param {string} props.label what the curve is of — a concept or a course name
 * @param {Array<{date: string, reviews: number, recall: number|null}>} props.points oldest first
 */
export default function LearningCurve({ label, points = [] }) {
  const known = points.filter((point) => point.recall != null);

  if (known.length < 2) {
    return (
      <p className="text-body-s text-ink-muted">
        Not enough review history yet to draw a curve — this fills in once the
        same material has come back around more than once.
      </p>
    );
  }

  const stepX = points.length > 1 ? (WIDTH - PAD * 2) / (points.length - 1) : 0;
  const y = (recall) => HEIGHT - PAD - recall * (HEIGHT - PAD * 2);

  let path = '';
  let drawing = false;

  points.forEach((point, index) => {
    if (point.recall == null) {
      drawing = false;
      return;
    }

    const x = PAD + index * stepX;
    path += `${drawing ? 'L' : 'M'} ${x} ${y(point.recall)} `;
    drawing = true;
  });

  const last = known.at(-1);

  return (
    <div className="flex flex-col gap-3">
      <svg
        role="img"
        aria-label={`${label}: ${percent(last.recall)} recall, most recently answered`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
      >
        {/* The floor, so a curve that dips near zero still reads against
            something rather than running off the bottom edge. */}
        <line
          x1={PAD}
          y1={HEIGHT - PAD}
          x2={WIDTH - PAD}
          y2={HEIGHT - PAD}
          className="text-rule"
          stroke="currentColor"
        />
        <path d={path.trim()} fill="none" strokeWidth="1.5" className="text-ink" stroke="currentColor" />
        {points.map((point, index) =>
          point.recall == null ? null : (
            <circle
              key={point.date}
              cx={PAD + index * stepX}
              cy={y(point.recall)}
              r="2"
              className="text-ink"
              fill="currentColor"
            />
          ),
        )}
      </svg>

      <p className="font-mono text-caption text-ink-muted">
        {percent(last.recall)} recall on {readDay(last.date)}, the most recent day answered ·{' '}
        {known.length} days with reviews in the window.
      </p>
    </div>
  );
}
