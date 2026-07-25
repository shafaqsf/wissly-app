'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, MessageSquare, Square, Wand2, X } from 'lucide-react';

import Transcript from '@/components/agent/transcript';

/* The agent, as the learner meets it: one line floating at the centre of the
   screen, lifting into a panel when it has something to say.

   Three things in here are design decisions rather than implementation.

   **The mode switch says who acts, not which model.** Chat reads and answers;
   Agent also writes. The wording is about consequence because that is what the
   learner is choosing between.

   **Sending never takes the field away.** A message sent while the agent is
   still working is queued and appears immediately, greyed by nothing — it is
   marked in words, per DESIGN.md, because there is no colour to mark it with.

   **Grain is the working state and the only one.** While a run is in flight
   the panel is a grain field at --grain-3 with the drift; when the answer
   lands it settles to --grain-1 over 600ms. Pages behind the bar carry their
   own field, so the bar tells them to stand down while it works: only one
   thing on a screen can be the unresolved thing. */

const MODES = [
  { id: 'chat', label: 'Chat', icon: MessageSquare, hint: 'Reads your material and answers. Changes nothing.' },
  { id: 'agent', label: 'Agent', icon: Wand2, hint: 'Acts for you: adds material, makes artefacts, organises. Every act can be undone.' },
];

export default function AgentBar({
  messages = [],
  mode: initialMode = 'chat',
  working = false,
  onSend,
  onStop,
  onModeChange,
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(initialMode);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const fieldRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // The page behind may hold a grain field of its own, and two competing
  // fields read as a texture pack rather than a signal.
  useEffect(() => {
    document.body.dataset.agentWorking = working ? 'true' : 'false';
    return () => {
      delete document.body.dataset.agentWorking;
    };
  }, [working]);

  async function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (text === '') return;

    setDraft('');
    setOpen(true);
    setError(null);

    const result = await onSend?.({ content: text, mode });
    if (result?.error) setError(result.error);
  }

  function chooseMode(next) {
    setMode(next);
    onModeChange?.(next);
  }

  const queued = messages.filter((message) => message.status === 'queued').length;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      data-working={working ? 'true' : 'false'}
    >
      {/* No shadow anywhere in this design language, so a floating surface
          separates from the page with a fill and a hairline instead. */}
      <div className="pointer-events-auto flex w-full max-w-2xl flex-col border border-rule bg-paper">
        {open ? (
          // The field goes here and not around the whole panel: DESIGN.md puts
          // a field *beside* a form, never behind one, and the text field is a
          // form. So the transcript carries the state and the controls below it
          // stay on clean paper — which is also what lets their labels remain
          // muted, since muted ink may not sit on a tinted field.
          //
          // The state class moves grain and colour together; there is no inline
          // --grain to set, and setting one would let the surface say one thing
          // with its texture and another with its hue.
          <div
            className={[
              'flex flex-col',
              `grain grain-field ${working ? 'field-unresolved' : 'field-settled'}`,
              working ? 'grain-working' : '',
            ].join(' ')}
          >
            <header className="flex min-h-14 items-center justify-between gap-4 border-b border-rule px-4">
              <p className="font-mono text-label uppercase">
                {working ? 'Working' : 'Your material'}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close the agent"
                className="flex size-11 items-center justify-center rounded-control"
              >
                <X size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </header>

            <Transcript messages={messages} working={working} />
          </div>
        ) : null}

        {error ? (
          <p
            role="status"
            className="border-l-2 border-l-ink border-b border-b-rule px-4 py-3 text-body-s"
          >
            {error}
          </p>
        ) : null}

        <form onSubmit={submit} className="flex flex-col gap-3 px-4 py-3">
          <div className="flex items-end gap-2">
            <label htmlFor="agent-field" className="sr-only">
              Ask about your material
            </label>
            <textarea
              id="agent-field"
              ref={fieldRef}
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={() => setOpen(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) submit(event);
              }}
              placeholder={
                mode === 'agent' ? 'Tell the agent what to do' : 'Ask about your material'
              }
              className="min-h-11 flex-1 resize-none bg-transparent py-2 text-body outline-none placeholder:text-ink-muted"
            />

            {working ? (
              <button
                type="button"
                onClick={onStop}
                className="flex size-11 shrink-0 items-center justify-center rounded-control border border-rule"
                aria-label="Stop the agent"
              >
                <Square size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={draft.trim() === ''}
                className="flex size-11 shrink-0 items-center justify-center rounded-control border border-rule disabled:text-ink-faint"
                aria-label="Send"
              >
                <ArrowUp size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="radiogroup" aria-label="What the agent may do" className="flex gap-1">
              {MODES.map(({ id, label, icon: Icon, hint }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={mode === id}
                  title={hint}
                  onClick={() => chooseMode(id)}
                  className={[
                    'flex min-h-11 items-center gap-2 rounded-control px-3 font-mono text-label uppercase',
                    // Selection is weight and a rule, never a fill of colour.
                    mode === id
                      ? 'border border-ink text-ink'
                      : 'border border-transparent text-ink-muted hover:text-ink',
                  ].join(' ')}
                >
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            {queued > 0 ? (
              <p className="font-mono text-caption text-ink-muted">
                {queued} waiting
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
