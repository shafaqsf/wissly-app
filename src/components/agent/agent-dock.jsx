'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as navigation from 'next/navigation';

import AgentBar from '@/components/agent/agent-bar';
import { openStream, reconnect as reconnectStream } from '@/components/agent/agent-stream';
import {
  archiveThreadAction,
  createStandingOrderAction,
  deleteStandingOrderAction,
  deleteThreadAction,
  listStandingOrdersAction,
  listThreadsAction,
  newThreadAction,
  openThreadAction,
  pinThreadAction,
  renameThreadAction,
  restoreThreadAction,
  runActionsAction,
  setStandingOrderEnabledAction,
  stopThreadAction,
  undoLastChangeAction,
  undoRunAction,
  updateStandingOrderAction,
  withdrawMessageAction,
} from '@/lib/actions/conversation';

/* The bar's other half: which conversation this is, and what happens when the
 * learner sends something.
 *
 * `AgentBar` renders a thread and reports what was pressed. This decides what
 * that means. Splitting them is what lets every rule in the bar be tested
 * without a database, a server action or a stream — and it is what lets the
 * event handling below be tested without a browser.
 *
 * **The stream is the send.** A message goes to `POST /api/agent/stream` and
 * the answer is written into its row as the deltas arrive. Three details of
 * that contract shape this file:
 *
 * - The `start` frame carries the persisted user message. The optimistic row
 *   drawn a moment earlier is replaced by it rather than reconciled with it,
 *   because the persisted id is what a withdraw is aimed at.
 * - The queue drains on the same connection, so a `done` is the end of a
 *   *turn* and only the close of the stream is the end of the response.
 * - A rewritten row arrives whole rather than as a suffix — that is what a
 *   failure message replacing a part-written answer looks like — so `content`
 *   replaces and `text` appends, and the two are never confused.
 *
 * **Navigation is the router and nothing else.** An intent is plain data
 * naming one of six places inside wissly; this pushes it. Nothing here reaches
 * into the DOM, and the transcript then says where it went, because a page
 * that changes under the learner in silence is disorienting. */

let optimistic = 0;

export default function AgentDock({
  conversation: initialConversation = null,
  messages: initialMessages = [],
  stream = {},
}) {
  // Read through the namespace so the frame's own tests, which mock
  // `next/navigation` down to the one export they use, still render this.
  // In the running app the router is always there; a navigation intent with
  // no router simply does not move, and the transcript still says nothing
  // happened rather than claiming it did.
  let router = null;
  try {
    router = navigation.useRouter();
  } catch {
    router = null;
  }
  const open = stream.open ?? openStream;
  const rejoin = stream.reconnect ?? reconnectStream;

  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [runs, setRuns] = useState({});
  const [intents, setIntents] = useState({});
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [threads, setThreads] = useState([]);
  const [archived, setArchived] = useState(false);
  const [orders, setOrders] = useState([]);
  /* Once the stream has said anything at all the panel stays up. A thread
     rejoined on load, a run that has just failed, an answer half written — all
     of them are things to be read, and none of them should need a click first. */
  const [lifted, setLifted] = useState(false);

  const abort = useRef(null);
  // The row the deltas are landing in, and the last user message sent — the
  // pair a terminal frame needs in order to know what it is finishing.
  const answering = useRef(null);
  const asking = useRef(null);
  /* The run the answer belongs to, when the stream named it before it ended —
     which is what a reconnect does, because a rejoined run is named on the
     frame that replays it rather than on the frame that started it. */
  const answeringRun = useRef(null);

  /* Reduced motion removes the animation, and streamed text is animation: a
     line that types itself is a movement nobody asked for. Held here and
     written once when the turn ends, the answer still arrives — it simply
     lands rather than performs. */
  const held = useRef('');
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

  const put = useCallback((message) => {
    setMessages((current) => {
      const at = current.findIndex((existing) => existing.id === message.id);
      if (at === -1) return [...current, message];

      const next = [...current];
      next[at] = { ...next[at], ...message };
      return next;
    });
  }, []);

  const handle = useCallback(
    (event) => {
      setLifted(true);

      switch (event.type) {
        case 'start': {
          // Read the ref here, not inside the updater: React runs an updater
          // when it pleases, and by then this ref has moved on.
          const drawn = asking.current;

          // The persisted row takes the place of the one drawn optimistically.
          setMessages((current) => [
            ...current.filter((message) => message.id !== drawn),
            event.message,
          ]);
          asking.current = event.message?.id ?? null;
          answering.current = null;
          answeringRun.current = null;
          held.current = '';
          break;
        }

        case 'resume': {
          if (event.messages) setMessages(event.messages);
          if (event.message) {
            answering.current = event.message.id;
            // The rejoined run's name, held until its ending needs it.
            answeringRun.current = event.runId ?? null;
            put(event.message);
            setWorking(event.message.status === 'running');
          } else {
            setWorking(false);
          }
          break;
        }

        case 'queued': {
          const drawn = asking.current;

          setMessages((current) => [
            ...current.filter((message) => message.id !== drawn),
            event.message,
          ]);
          asking.current = null;
          break;
        }

        case 'delta': {
          if (!answering.current) {
            answering.current = `answer-${optimistic += 1}`;
            put({
              id: answering.current,
              role: 'assistant',
              content: '',
              status: 'running',
              mode: conversation?.mode ?? 'chat',
            });
          }

          held.current += event.text ?? '';
          // Under reduced motion the text is held and written once, at the end.
          if (!reduced) put({ id: answering.current, content: held.current, status: 'running' });
          break;
        }

        case 'intent': {
          if (event.intent?.kind !== 'navigate' || !router) break;
          perform(event.intent, router);

          // The intent belongs to the answer being written, or — before the
          // first delta — to the message that asked for it.
          const key = answering.current ?? asking.current;
          if (key) {
            setIntents((current) => ({
              ...current,
              [key]: [...(current[key] ?? []), event.intent],
            }));
          }
          break;
        }

        case 'done':
        case 'stopped':
        case 'failed': {
          const id = answering.current ?? `answer-${optimistic += 1}`;

          put({
            id,
            role: 'assistant',
            // A terminal frame carries the row whole. Appending it to what the
            // deltas built would print a failure twice over half an answer.
            content: event.content ?? held.current,
            status: event.type === 'done' ? 'done' : event.type,
            mode: conversation?.mode ?? 'chat',
          });

          // Whether the run named itself decides how much can be said about
          // what it changed. Named: counted, and undone by name. Unnamed: it
          // can still be taken back, and the words say so without a number.
          const runId = event.runId ?? answeringRun.current ?? null;
          const changed = (conversation?.mode ?? 'chat') === 'agent';
          // A chat turn that succeeded changed nothing, so it gets no report —
          // naming its run must not put an undo under an answer with nothing
          // behind it.
          const reportable = event.type === 'failed' || changed;

          if (reportable) {
            setRuns((current) => ({
              ...current,
              [id]: {
                runId,
                completed: event.completed ?? [],
                outstanding: runId ? 0 : changed ? null : 0,
              },
            }));

            if (runId) count(runId, id, setRuns);
          }

          held.current = '';
          answering.current = null;
          answeringRun.current = null;
          asking.current = null;
          setWorking(false);
          break;
        }

        default:
          break;
      }
    },
    [conversation?.mode, put, reduced, router],
  );

  /* Leaving the page lets go of the reader, never of the run. The turn keeps
     writing to its row on the server and is picked up again from `resume`,
     which is the whole reason every delta is persisted as it arrives. */
  useEffect(() => () => abort.current?.abort(), []);

  // Rejoin whatever is already happening: a reload, a second tab, a laptop
  // reopened, or the five-minute cap having closed a long stream.
  useEffect(() => {
    if (!conversation?.id) return undefined;

    const controller = new AbortController();
    rejoin({ conversationId: conversation.id, signal: controller.signal, onEvent: handle });

    return () => controller.abort();
    // Rejoining is per conversation, not per render of the handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  async function send({ content, mode, model }) {
    setError(null);

    let thread = conversation;
    if (!thread) {
      const created = await newThreadAction({ mode });
      if (created.error) {
        setError(created.error);
        return;
      }
      thread = created.conversation;
      setConversation(thread);
    } else if (mode && mode !== thread.mode) {
      // Mode is per message and the route records it; the local copy follows
      // so the transcript labels the next line correctly.
      thread = { ...thread, mode };
      setConversation(thread);
    }

    // On the screen before the server has seen it. Replaced by the persisted
    // row when `start` or the 202 lands.
    const pending = `pending-${(optimistic += 1)}`;
    asking.current = pending;
    setMessages((current) => [
      ...current,
      { id: pending, role: 'user', content, status: 'running', mode, model },
    ]);

    setWorking(true);
    abort.current = new AbortController();

    await open({
      conversationId: thread.id,
      content,
      mode,
      model: model || undefined,
      signal: abort.current.signal,
      onEvent: handle,
    });

    setWorking(false);
  }

  async function stop() {
    if (!conversation) return;

    // The server marks the turn stopped; the reader is let go afterwards, so
    // the stopped frame is still read. A queued message is untouched — the
    // learner asked for the turn to end, not to lose what they just typed.
    await stopThreadAction({ conversationId: conversation.id });
    setWorking(false);
  }

  async function withdraw(id) {
    if (!conversation) return;

    const result = await withdrawMessageAction({ conversationId: conversation.id, id });
    if (result?.error) {
      setError(result.error);
      return;
    }

    setMessages((current) => current.filter((message) => message.id !== id));
  }

  async function undo(runId) {
    const result = runId
      ? await undoRunAction({ runId })
      : await undoLastChangeAction({ conversationId: conversation?.id });

    if (result?.error) {
      setError(result.error);
      return;
    }

    // Undo reports in words either way: what came back, or what did not. A
    // silent undo leaves the learner unsure whether it ran at all.
    setError(result?.message ?? null);
    setRuns((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, run]) =>
          runId === null || run.runId === runId
            ? [id, { ...run, undone: true, outstanding: 0 }]
            : [id, run],
        ),
      ),
    );
    router.refresh?.();
  }

  const loadThreads = useCallback(
    async (wantArchived = archived) => {
      const result = await listThreadsAction({ archived: wantArchived });
      if (result.error) {
        setError(result.error);
        return;
      }
      setThreads(result.threads);
    },
    [archived],
  );

  const loadOrders = useCallback(async () => {
    const result = await listStandingOrdersAction();
    if (result.error) {
      setError(result.error);
      return;
    }
    setOrders(result.orders);
  }, []);

  async function openThread(id) {
    const result = await openThreadAction({ id });
    if (result.error) {
      setError(result.error);
      return;
    }

    setConversation(result.conversation);
    setMessages(result.messages);
    setRuns({});
    setIntents({});
  }

  async function newThread() {
    const created = await newThreadAction({ mode: conversation?.mode ?? 'chat' });
    if (created.error) {
      setError(created.error);
      return;
    }

    setConversation(created.conversation);
    setMessages([]);
    setRuns({});
    setIntents({});
  }

  /** Every list action ends the same way: do it, then read the list back. */
  function thenReload(action) {
    return async (...args) => {
      const result = await action(...args);
      if (result?.error) setError(result.error);
      await loadThreads();
    };
  }

  function thenReloadOrders(action) {
    return async (...args) => {
      const result = await action(...args);
      if (result?.error) {
        setError(result.error);
        return result;
      }
      await loadOrders();
      return result;
    };
  }

  return (
    <AgentBar
      messages={messages}
      threads={threads}
      orders={orders}
      openThreadId={conversation?.id ?? null}
      archived={archived}
      mode={conversation?.mode ?? 'chat'}
      working={working}
      lifted={lifted}
      error={error}
      runs={runs}
      intents={intents}
      onSend={send}
      onStop={stop}
      onWithdraw={withdraw}
      onUndo={undo}
      onLoadThreads={() => loadThreads()}
      onOpenThread={openThread}
      onNewThread={newThread}
      onRenameThread={thenReload((id, title) => renameThreadAction({ id, title }))}
      onPinThread={thenReload((id, pinned) => pinThreadAction({ id, pinned }))}
      onArchiveThread={thenReload((id) => archiveThreadAction({ id }))}
      onRestoreThread={thenReload((id) => restoreThreadAction({ id }))}
      onDeleteThread={thenReload((id) => deleteThreadAction({ id }))}
      onShowArchived={(next) => {
        setArchived(next);
        loadThreads(next);
      }}
      onLoadOrders={loadOrders}
      onCreateOrder={thenReloadOrders((fields) => createStandingOrderAction(fields))}
      onUpdateOrder={thenReloadOrders((fields) => updateStandingOrderAction(fields))}
      onToggleOrder={thenReloadOrders((id, enabled) =>
        setStandingOrderEnabledAction({ id, enabled }),
      )}
      onDeleteOrder={thenReloadOrders((id) => deleteStandingOrderAction({ id }))}
    />
  );
}

/* An intent is data, and this is the only place it becomes a movement. The
   router, never the DOM: the agent runs on the server and the one thing that
   crosses back is this object. */
function perform(intent, router) {
  const query = new URLSearchParams(intent.query ?? {}).toString();
  router.push(query === '' ? intent.path : `${intent.path}?${query}`);
}

/* How much of a run is still standing. `runActionsAction` counts the writes
   that carry something to reverse and have not been reversed — which is not
   the number of things it did, and the difference is the whole point: a run of
   thirty that died on the twenty-ninth leaves a real number behind, and Undo
   on a guess is not a decision. */
async function count(runId, messageId, setRuns) {
  const result = await runActionsAction({ runId });
  if (result?.error) return;

  setRuns((current) => ({
    ...current,
    [messageId]: { ...current[messageId], runId, outstanding: result.outstanding },
  }));
}
