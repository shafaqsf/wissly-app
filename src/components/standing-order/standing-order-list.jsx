'use client';

import { useState } from 'react';
import { Pause, Pencil, Play, Trash2 } from 'lucide-react';

/* The agent acting with nobody present.
 *
 * A surface of its own beside the history, because a standing order is not a
 * conversation: nothing was asked, and the report lands in a thread afterwards
 * rather than in front of anyone. That is unusual enough that the empty state
 * explains it before the first one is written.
 *
 * The schedule is plain text — the scheduler reads "daily", "weekly",
 * "monthly" and "every 3 days" — so the shape is said in the field's own hint
 * rather than guessed at. The server checks it again and its words win. */

const SCHEDULE_HINT = 'Say daily, weekly, monthly, or “every 3 days”.';

const NO_SCHEDULE = `A standing order needs a schedule, or nothing would ever run it. ${SCHEDULE_HINT}`;

function ranWord(order) {
  if (!order.last_run_at) return 'Has not run yet';
  return `Last ran ${new Date(order.last_run_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })}`;
}

export default function StandingOrderList({
  orders = [],
  onCreate,
  onUpdate,
  onToggle,
  onDelete,
}) {
  const [editing, setEditing] = useState(null);
  const [instruction, setInstruction] = useState('');
  const [schedule, setSchedule] = useState('');
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null);

  function startEdit(order) {
    setEditing(order.id);
    setInstruction(order.instruction);
    setSchedule(order.schedule);
    setError(null);
  }

  function reset() {
    setEditing(null);
    setInstruction('');
    setSchedule('');
  }

  async function submit(event) {
    event.preventDefault();

    const what = instruction.trim();
    const when = schedule.trim();

    if (what === '') {
      setError('Say what the agent should do.');
      return;
    }

    if (when === '') {
      setError(NO_SCHEDULE);
      return;
    }

    setError(null);

    const result = editing
      ? await onUpdate?.({ id: editing, instruction: what, schedule: when })
      : await onCreate?.({ instruction: what, schedule: when });

    // The server checks the schedule again and knows more than this form
    // does, so when it refuses, its words are the ones shown.
    if (result?.error) {
      setError(result.error);
      return;
    }

    reset();
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <p className="max-w-measure text-body">
        A standing order is something the agent does on a schedule, without you
        being here. It reports back as a message you can read later.
      </p>

      {orders.length > 0 ? (
        <ol className="motion-stagger flex max-h-[30vh] flex-col gap-2 overflow-y-auto">
          {orders.map((order) => (
            <li
              key={order.id}
              data-testid={`order-${order.id}`}
              className="flex flex-col gap-2 rounded-surface border border-rule px-3 py-2"
            >
              <p className="max-w-measure text-body-s">{order.instruction}</p>

              {/* State in words, in the mono face the system uses to talk about
                  itself. Nothing here is carried by a colour. */}
              <p className="font-mono text-caption uppercase text-ink-muted">
                {[order.schedule, order.enabled ? 'Running' : 'Paused', ranWord(order)].join(' · ')}
              </p>

              <div className="flex flex-wrap items-center gap-1">
                <RowAction
                  icon={order.enabled ? Pause : Play}
                  label={order.enabled ? 'Turn off' : 'Turn on'}
                  onClick={() => onToggle?.(order.id, !order.enabled)}
                />
                <RowAction icon={Pencil} label="Edit" onClick={() => startEdit(order)} />
                <RowAction icon={Trash2} label="Delete" onClick={() => setConfirming(order.id)} />
              </div>

              {confirming === order.id ? (
                <div className="flex flex-col gap-2 border-l-2 border-l-ink pl-3 text-body-s">
                  <p className="max-w-measure">
                    This stops the order and removes it. What it has already done
                    stays where it is.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null);
                        onDelete?.(order.id);
                      }}
                      className="motion-lift min-h-11 rounded-control border border-ink px-3 font-mono text-label uppercase"
                    >
                      Delete for good
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="motion-lift min-h-11 rounded-control border border-rule px-3 font-mono text-label uppercase"
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="order-instruction" className="font-mono text-caption text-ink-muted">
            What should the agent do
          </label>
          <input
            id="order-instruction"
            type="text"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            className="min-h-11 w-full rounded-control border border-rule bg-paper px-3 text-body-s"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="order-schedule" className="font-mono text-caption text-ink-muted">
            How often — {SCHEDULE_HINT}
          </label>
          <input
            id="order-schedule"
            type="text"
            value={schedule}
            onChange={(event) => setSchedule(event.target.value)}
            className="min-h-11 w-full rounded-control border border-rule bg-paper px-3 text-body-s"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="motion-lift min-h-11 rounded-control border border-rule px-3 font-mono text-label uppercase"
          >
            {editing ? 'Save order' : 'Add standing order'}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={reset}
              className="motion-lift min-h-11 rounded-control border border-transparent px-3 font-mono text-label uppercase text-ink-muted"
            >
              Cancel
            </button>
          ) : null}
        </div>

        {error ? (
          <p role="status" className="max-w-measure border-l-2 border-l-ink pl-3 text-body-s">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function RowAction({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="motion-lift flex min-h-11 items-center gap-1 rounded-control border border-transparent px-2 font-mono text-caption uppercase text-ink-muted hover:text-ink"
    >
      <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
      {label}
    </button>
  );
}
