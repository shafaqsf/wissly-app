'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, MessageSquare, Square, Undo2, Wand2, X } from 'lucide-react';

import Transcript from '@/components/agent/transcript';
import BrandMark from '@/components/brand/brand-mark';

/* The agent, as the learner meets it: one line floating at the centre of the
   screen, lifting into a panel when it has something to say.

   Three things in here are design decisions rather than implementation.

   **The mode switch says who acts, not which model.** Chat reads and answers;
   Agent also writes. The wording is about consequence because that is what the
   learner is choosing between.

   **Sending never takes the field away.** A message sent while the agent is
   still working is queued and appears immediately, marked in words rather than
   by a tint, because a queue is a status and status carries no depth.

   **The working state is a mark and a word, not a surface.** The transcript
   used to be tinted while a run was in flight — a grey panel that the answer
   then had to be read on top of. It is a mark beside the word "Working" now,
   drifting until the answer lands. That also ends the arbitration the bar used
   to need with the page behind it: nothing paints a background any more, so
   there is nothing for two surfaces to compete over. */

const MODES = [
  { id: 'chat', label: 'Chat', icon: MessageSquare, hint: 'Reads your material and answers. Changes nothing.' },
  { id: 'agent', label: 'Agent', icon: Wand2, hint: 'Acts for you: adds material, makes artefacts, organises. Every act can be undone.' },
];

export default function AgentBar({
  messages = [],
  mode: initialMode = 'chat',
  working = false,
  canUndo = false,
  onSend,
  onStop,
  onModeChange,
  onUndo,
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

  async function undo() {
    setError(null);
    const result = await onUndo?.();
    // Undo reports in words either way: what came back, or what did not. A
    // silent undo leaves the learner unsure whether it ran at all.
    if (result?.error || result?.message) setError(result.error ?? result.message);
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
      <div className="pointer-events-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-surface border border-rule bg-paper">
        {open ? (
          <div className="flex flex-col">
            <header className="flex min-h-14 items-center justify-between gap-4 border-b border-rule px-4">
              {/* The mark says who is speaking, once. Repeating it on every
                  turn would put a column of the same image down the
                  transcript, which reads as texture rather than as identity. */}
              <p className="flex items-center gap-2 font-mono text-label uppercase">
                <BrandMark size={20} />
                {working ? 'Working' : 'Your material'}
                {/* The state, on the thing that has it. It drifts while the
                    run is in flight and settles when the answer lands — the
                    word beside it is what carries the meaning. */}
                {working ? (
                  <span
                    aria-hidden="true"
                    className="grain grain-mark grain-working field-unresolved"
                    style={{ '--grain': 'var(--grain-3)' }}
                  />
                ) : null}
              </p>
              <div className="flex items-center gap-1">
                {/* Agent mode acts without asking at each step, so the way back
                    has to be as reachable as the way forward. */}
                {canUndo && !working ? (
                  <button
                    type="button"
                    onClick={undo}
                    className="flex min-h-11 items-center gap-2 rounded-control border border-rule px-3 font-mono text-label uppercase"
                  >
                    <Undo2 size={16} strokeWidth={1.5} aria-hidden="true" />
                    Undo
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close the agent"
                  className="flex size-11 items-center justify-center rounded-control"
                >
                  <X size={20} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
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
              // The radius is here for the focus ring. An outline follows the
              // element's own corner, so a square control draws a square ring
              // inside a rounded bar — see "Shape" in docs/DESIGN.md.
              className="min-h-11 flex-1 resize-none rounded-control bg-transparent px-2 py-2 text-body placeholder:text-ink-muted"
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
                    // Selection is weight and a rule, never a fill.
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
