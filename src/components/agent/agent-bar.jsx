'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUp, CalendarClock, MessagesSquare, Square, X } from 'lucide-react';

import ModePicker from '@/components/agent/mode-picker';
import ModelPicker from '@/components/agent/model-picker';
import Transcript from '@/components/agent/transcript';
import BrandMark from '@/components/brand/brand-mark';
import ConversationList from '@/components/conversation/conversation-list';
import StandingOrderList from '@/components/standing-order/standing-order-list';

/* The agent, as the learner meets it.
 *
 * **One bar, one thread, two modes.** Chat and Agent are not two interfaces
 * and this is not two components: it is a single line at the foot of the
 * screen that lifts into a panel — transcript above, field below, the
 * conversations and the standing orders reachable from its edge. Mode and
 * model are dropdowns beside the field because they are settings that ride
 * along with a message, not places to be in.
 *
 * **Sending never takes the field away.** A message sent while a run is in
 * flight is written `queued` and rendered immediately. It is marked in words,
 * because a queue is a status and status carries no depth.
 *
 * **The working state is a mark and a word, never a surface.** The panel used
 * to be tinted while a run was in flight — a grey box the answer then had to
 * be read on top of. It is a `.grain-mark field-unresolved` beside the word
 * "Working" now, drifting while the run is in flight and settling to
 * `.field-settled` over 600ms when the answer lands. That is also what ends the arbitration this bar used
 * to need with the page behind it: nothing paints a background any more, so
 * there is nothing for two surfaces to compete over. The bar still says it is
 * working on the element the frame can read, so a page with a state of its own
 * can stand down while the agent has something to say.
 *
 * **The mark, once.** The sidebar gave its `BrandMark` up, so this is the one
 * place per viewport where the product names itself. One per bar, in the
 * header, never once per turn: a column of the same coloured image down a
 * transcript reads as texture, which is the one thing the design language will
 * not have.
 *
 * The bar renders and reports. It reaches for no server action, holds no
 * conversation and knows nothing about a stream — `AgentDock` does all three.
 * That split is what lets every rule above be tested without a database. */

const PLACEHOLDER = {
  chat: 'Ask about your material',
  agent: 'Tell the agent what to do',
};

const VIEWS = { transcript: 'transcript', threads: 'threads', orders: 'orders' };

export default function AgentBar({
  messages = [],
  threads = [],
  orders = [],
  openThreadId = null,
  archived = false,
  mode: initialMode = 'chat',
  model: initialModel = '',
  working = false,
  lifted = false,
  error = null,
  runs = {},
  intents = {},
  onSend,
  onStop,
  onWithdraw,
  onUndo,
  onModeChange,
  onModelChange,
  onLoadThreads,
  onOpenThread,
  onNewThread,
  onRenameThread,
  onPinThread,
  onArchiveThread,
  onRestoreThread,
  onDeleteThread,
  onShowArchived,
  onLoadOrders,
  onCreateOrder,
  onUpdateOrder,
  onToggleOrder,
  onDeleteOrder,
}) {
  const [open, setOpen] = useState(false);
  /* The panel lifts itself when there is something to watch — a run in flight,
     or a thread the dock has just rejoined. A bar answering behind a closed
     line would be reporting to nobody. */
  const shown = open || working || lifted;
  const [view, setView] = useState(VIEWS.transcript);
  const [mode, setMode] = useState(initialMode);
  const [modeGiven, setModeGiven] = useState(initialMode);
  const [model, setModel] = useState(initialModel);
  const [draft, setDraft] = useState('');

  /* Opening another conversation brings its mode with it. Adjusted during the
     render that brings it rather than in an effect afterwards: an effect would
     paint the old mode for a frame, and this is a control the learner may be
     looking straight at. */
  if (initialMode !== modeGiven) {
    setModeGiven(initialMode);
    setMode(initialMode);
  }

  useEffect(() => {
    if (!shown) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [shown]);

  function submit(event) {
    event?.preventDefault?.();

    const content = draft.trim();
    if (content === '') return;

    setDraft('');
    setOpen(true);
    setView(VIEWS.transcript);

    // Straight through, working or not. The dock decides whether this becomes
    // a turn or a queued row; the field is available again either way.
    onSend?.({ content, mode, model });
  }

  function chooseMode(next) {
    setMode(next);
    onModeChange?.(next);
  }

  function chooseModel(next) {
    setModel(next);
    onModelChange?.(next);
  }

  function show(next) {
    setView(next);
    setOpen(true);
    if (next === VIEWS.threads) onLoadThreads?.();
    if (next === VIEWS.orders) onLoadOrders?.();
  }

  const waiting = messages.filter((message) => message.status === 'queued').length;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      // While the agent works, this is the field that counts. The frame reads
      // it and holds the page's own state down to the ambient intensity, so
      // there is one state being reported per viewport rather than two.
      data-agent-working={working ? 'true' : 'false'}
    >
      {/* There are no shadows in this design language, so a floating surface
          separates from the page with a paper fill and a hairline — and that
          is the whole treatment. */}
      <div
        data-testid="agent-panel"
        className="motion-slide pointer-events-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-surface border border-rule bg-paper"
      >
        {shown ? (
          <div className="flex flex-col">
            <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2">
              <p
                data-testid="agent-state"
                className="flex items-center gap-2 font-mono text-label uppercase"
              >
                <BrandMark size={20} />
                {working ? 'Working' : 'Your material'}
                {/* The state sits on the thing that has it, beside the word
                    that names it. One class moves the grain and the fill
                    together, so the texture and the fill cannot say different
                    things — see "The field" in docs/DESIGN.md. */}
                <span
                  aria-hidden="true"
                  className={
                    working
                      ? 'grain grain-mark grain-working field-unresolved'
                      : 'grain grain-mark field-settled'
                  }
                  style={{ '--grain': working ? 'var(--grain-3)' : 'var(--grain-0)' }}
                />
              </p>

              <div className="flex flex-wrap items-center gap-1">
                {view === VIEWS.transcript ? (
                  <>
                    <HeaderAction
                      icon={MessagesSquare}
                      label="Conversations"
                      onClick={() => show(VIEWS.threads)}
                    />
                    <HeaderAction
                      icon={CalendarClock}
                      label="Standing orders"
                      onClick={() => show(VIEWS.orders)}
                    />
                  </>
                ) : (
                  <HeaderAction
                    icon={ArrowLeft}
                    label="Back to the conversation"
                    onClick={() => setView(VIEWS.transcript)}
                  />
                )}

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

            {view === VIEWS.transcript ? (
              <Transcript
                messages={messages}
                working={working}
                runs={runs}
                intents={intents}
                onWithdraw={onWithdraw}
                onUndo={onUndo}
              />
            ) : null}

            {view === VIEWS.threads ? (
              <ConversationList
                threads={threads}
                openId={openThreadId}
                archived={archived}
                onOpen={(id) => {
                  onOpenThread?.(id);
                  setView(VIEWS.transcript);
                }}
                onNew={() => {
                  onNewThread?.();
                  setView(VIEWS.transcript);
                }}
                onRename={onRenameThread}
                onPin={onPinThread}
                onArchive={onArchiveThread}
                onRestore={onRestoreThread}
                onDelete={onDeleteThread}
                onShowArchived={onShowArchived}
              />
            ) : null}

            {view === VIEWS.orders ? (
              <StandingOrderList
                orders={orders}
                onCreate={onCreateOrder}
                onUpdate={onUpdateOrder}
                onToggle={onToggleOrder}
                onDelete={onDeleteOrder}
              />
            ) : null}
          </div>
        ) : null}

        {/* A failure rules its own paragraph. That 2px ink border is the only
            one in the product, so it reads instantly without a colour. */}
        {error ? (
          <p
            role="status"
            className="border-b border-b-rule border-l-2 border-l-ink px-4 py-3 text-body-s"
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
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={() => setOpen(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) submit(event);
              }}
              placeholder={PLACEHOLDER[mode]}
              // The radius is here for the focus ring: an outline takes the
              // element's own corner, so a square control draws a square ring
              // inside a rounded bar.
              className="min-h-11 flex-1 resize-none rounded-control bg-transparent px-2 py-2 text-body placeholder:text-ink-muted"
            />

            {/* Stop and Send are two controls, not one that changes its mind:
                a run in flight can be stopped *and* a further message sent, and
                a single button could only ever offer one of them. */}
            {working ? (
              <button
                type="button"
                onClick={onStop}
                title="Ends the turn that is running. Anything waiting behind it still runs."
                className="motion-lift flex min-h-11 shrink-0 items-center gap-2 rounded-control border border-rule px-3 font-mono text-label uppercase"
              >
                <Square size={16} strokeWidth={1.5} aria-hidden="true" />
                Stop
              </button>
            ) : null}

            <button
              type="submit"
              className="motion-lift flex min-h-11 shrink-0 items-center gap-2 rounded-control border border-rule px-3 font-mono text-label uppercase"
            >
              <ArrowUp size={16} strokeWidth={1.5} aria-hidden="true" />
              Send
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ModePicker mode={mode} onChange={chooseMode} />
            <ModelPicker model={model} onChange={chooseModel} />

            {waiting > 0 ? (
              <p className="font-mono text-caption text-ink-muted">{waiting} waiting</p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

function HeaderAction({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="motion-lift flex min-h-11 items-center gap-2 rounded-control border border-transparent px-2 font-mono text-label uppercase text-ink-muted hover:text-ink"
    >
      <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
      {label}
    </button>
  );
}
