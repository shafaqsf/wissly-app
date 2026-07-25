import DayBars from './day-bars';

/* What the agent costs.

   There is no spending cap, by design, so this is the only thing standing
   between the learner and a surprise. That makes it a first-class surface
   rather than a footnote: the total, the number of calls, and the shape of the
   week.

   It used to split the total between what the learner asked for and what the
   agent decided alone. Standing orders were the only source of the second
   kind and they were removed, so the split would now be a legend for a
   distinction that no longer exists — every call has a person behind it.

   `motion-count` without `data-count` is the typography half of the class —
   monospace and tabular figures, so a cost that changes does not shuffle its
   digits sideways. The animated counter is integers only, and money is not. */

export function money(value) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

export default function Effort({ days = [] }) {
  const calls = days.reduce((total, day) => total + (day.calls || 0), 0);
  const cost = days.reduce((total, day) => total + (day.cost || 0), 0);

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

      <DayBars
        label="Cost per day"
        days={days.map((day) => ({ date: day.date, value: day.cost }))}
        unit="dollar"
        format={money}
      />
    </div>
  );
}
