import DayBars from './day-bars';

/* What the agent costs.

   There is no spending cap, by design, so this is the only thing standing
   between the learner and a surprise. That makes it a first-class surface
   rather than a footnote: the total, the split between what was asked for and
   what the agent decided on its own, and the shape of the week.

   `motion-count` without `data-count` is the typography half of the class —
   monospace and tabular figures, so a cost that changes does not shuffle its
   digits sideways. The animated counter is integers only, and money is not. */

export function money(value) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

export default function Effort({ days = [] }) {
  const calls = days.reduce((total, day) => total + (day.calls || 0), 0);
  const cost = days.reduce((total, day) => total + (day.cost || 0), 0);
  const asked = days.reduce((total, day) => total + (day.byCause?.user || 0), 0);
  const decided = days.reduce((total, day) => total + (day.byCause?.schedule || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="motion-count text-display-l font-bold">{money(cost)}</p>
        <p className="font-mono text-caption text-ink-muted">
          {calls === 1 ? '1 model call' : `${calls} model calls`} over seven days
        </p>
        {calls === 0 ? (
          <p className="text-body-s text-ink-muted">Nothing spent yet.</p>
        ) : null}
      </div>

      <dl className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-3">
          <dt className="text-body-s text-ink-muted">You asked for</dt>
          <dd className="motion-count text-body-s">{money(asked)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-3">
          <dt className="text-body-s text-ink-muted">The agent decided</dt>
          <dd className="motion-count text-body-s">{money(decided)}</dd>
        </div>
      </dl>

      <DayBars
        label="Cost per day"
        days={days.map((day) => ({ date: day.date, value: day.cost }))}
        unit="dollar"
        format={money}
      />
    </div>
  );
}
