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
  { id: 'agent', label: 'Agent', consequence: 'acts for you, and every act can be undone' },
];

export default function ModePicker({ mode = 'chat', onChange, disabled = false, id = 'agent-mode' }) {
  return (
    <div className="flex flex-col gap-1">
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
        className="min-h-11 rounded-control border border-rule bg-paper px-3 font-mono text-label uppercase text-ink"
      >
        {MODES.map(({ id: value, label, consequence }) => (
          <option key={value} value={value}>
            {label} — {consequence}
          </option>
        ))}
      </select>
    </div>
  );
}
