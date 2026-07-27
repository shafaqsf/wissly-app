'use client';

/* Who acts on this message.
 *
 * It was two toggle buttons, which said the two modes were two interfaces.
 * They are not: it is one bar and one thread, and the mode is a property of
 * the line being sent — ask what a σ-algebra is in Chat, switch to Agent, say
 * "make me ten cards on that", same thread and same context. A dropdown is the
 * shape of a setting that rides along with a message; a pair of tabs is the
 * shape of two places, and there is only one place here.
 *
 * The difference is *who acts*, never which model, so nothing in this file
 * knows a model exists. Mode and model sit side by side and never meet. */

export const MODES = [
  { id: 'chat', label: 'Chat', consequence: 'reads your material, changes nothing' },
  {
    id: 'socratic',
    label: 'Socratic',
    consequence: 'asks guiding questions instead of answering, changes nothing',
  },
  { id: 'agent', label: 'Agent', consequence: 'acts for you, and every act can be undone' },
];

/** What the mode in force will do, for the line under the control. */
export function consequenceOf(mode) {
  return MODES.find(({ id }) => id === mode)?.consequence ?? '';
}

export default function ModePicker({ mode = 'chat', onChange, disabled = false, id = 'agent-mode' }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        What the agent may do
      </label>
      <select
        id={id}
        value={mode}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        // The radius is here for the focus ring: an outline takes the
        // element's own corner, so a square control draws a square ring in an
        // interface that has none — see "Shape" in docs/DESIGN.md.
        className="min-h-11 w-full rounded-control border border-rule bg-paper px-3 font-mono text-label uppercase text-ink"
      >
        {MODES.map(({ id: value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {/* The consequence rode inside the option text until it made the closed
          control forty characters wide and pushed the model picker onto its
          own line. It says the same thing here, about the mode actually in
          force, and no longer decides the layout. */}
      <p className="font-mono text-caption text-ink-muted">{consequenceOf(mode)}</p>
    </div>
  );
}
