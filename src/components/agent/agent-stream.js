/* The wire between the bar and the run.
 *
 * `POST /api/agent/stream` answers `text/event-stream`, one frame per runtime
 * event: the `event:` line carries the type (`delta`, `tool`, `intent`,
 * `done`, `stopped`, `failed`) and the `data:` line carries that event as JSON.
 * `GET /api/agent/stream?conversationId=…` replays what is already persisted
 * and then continues live, which is what a reload resumes from.
 *
 * It is a module of its own rather than a hook because the parsing is the part
 * worth testing, and it is testable here without a component, a server or a
 * browser. Nothing in here touches React, and nothing in here touches the DOM.
 */

/** Where the route lives. One spelling, so a rename is one edit. */
export const STREAM_PATH = '/api/agent/stream';

/**
 * Read an SSE body, calling back once per complete frame.
 *
 * Frames are split on a blank line and never on a chunk boundary — a network
 * chunk can end mid-word, and a parser that assumed otherwise would drop the
 * end of an answer roughly whenever the answer was long.
 *
 * @param {ReadableStream<Uint8Array>} body
 * @param {(event: {type: string}) => void} onEvent
 */
export async function readEventStream(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let split = buffer.indexOf('\n\n');
      while (split !== -1) {
        emit(buffer.slice(0, split), onEvent);
        buffer = buffer.slice(split + 2);
        split = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  if (buffer.trim() !== '') emit(buffer, onEvent);
}

function emit(frame, onEvent) {
  let type = null;
  const data = [];

  for (const line of frame.split('\n')) {
    // A comment line is the keep-alive that holds a proxy open. It is not an
    // event and it must not look like one.
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) type = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trim());
  }

  if (!type) return;

  let payload = {};
  try {
    payload = data.length > 0 ? JSON.parse(data.join('\n')) : {};
  } catch {
    // A frame nobody can parse is one frame lost, not a conversation lost.
    return;
  }

  onEvent({ ...payload, type });
}

/** What the learner is told when the connection, not the agent, is what broke. */
const UNREACHABLE = 'The agent could not be reached. Check your connection and try again.';

/**
 * Send a message and read its answer as it is written.
 *
 * Resolves when the run has ended. Every outcome — including the ones that are
 * nobody's answer — arrives through `onEvent`, so the caller has one path to
 * render rather than a stream and an exception.
 *
 * @param {object} params
 * @param {string} params.conversationId
 * @param {string} params.content
 * @param {string} [params.mode]
 * @param {string} [params.model]
 * @param {AbortSignal} [params.signal]
 * @param {(event: {type: string}) => void} params.onEvent
 * @param {typeof fetch} [params.fetchImpl]
 */
export async function openStream({
  conversationId,
  content,
  mode,
  model,
  signal,
  onEvent,
  fetchImpl = globalThis.fetch,
}) {
  try {
    const response = await fetchImpl(STREAM_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId, content, mode, model }),
      signal,
    });

    // 202: a run was already in flight, so the message was stored `queued` and
    // no stream opened at all. The row comes back as JSON and is rendered
    // immediately — the field is never taken away from the learner.
    if (response.status === 202) {
      const body = await readJson(response);
      onEvent({ ...body, type: 'queued' });
      return;
    }

    if (!response.ok) {
      const body = await readJson(response);
      // The server's words when it has any: "that is not a model id" is
      // something the learner can act on and "try again" is not.
      onEvent({ type: 'failed', content: body?.error ?? UNREACHABLE, completed: [] });
      return;
    }

    if (!response.body) {
      onEvent({ type: 'failed', content: UNREACHABLE, completed: [] });
      return;
    }

    // Read to the close of the stream, never to the first terminal frame. The
    // queue drains on this same connection, so a `done` can be followed by
    // another `start` and another `done` — up to ten of them.
    await readEventStream(response.body, onEvent);
  } catch (error) {
    // An abort is the Stop button doing what it was pressed for. Reporting it
    // as a failure would tell the learner something went wrong with the thing
    // they just asked for.
    if (error?.name === 'AbortError') return;
    onEvent({ type: 'failed', content: UNREACHABLE, completed: [] });
  }
}

async function readJson(response) {
  try {
    return await response.json?.();
  } catch {
    return null;
  }
}

/**
 * Rejoin whatever is happening in a thread — a reload, a second tab, a laptop
 * reopened, or the five-minute cap closing a long stream.
 *
 * Two shapes come back and both are ordinary. Nothing running answers JSON
 * with the settled thread; something running answers a stream that opens with
 * a `resume` frame and continues with the deltas as the row grows. Both are
 * handed to the caller as a `resume` event, so there is one thing to render.
 *
 * A rewritten row arrives whole rather than as a suffix — that is what a
 * failure message replacing a part-written answer looks like — so a caller
 * renders `content` when it is given rather than appending it.
 */
export async function reconnect({
  conversationId,
  signal,
  onEvent,
  fetchImpl = globalThis.fetch,
}) {
  try {
    const response = await fetchImpl(
      `${STREAM_PATH}?conversationId=${encodeURIComponent(conversationId)}`,
      { signal },
    );

    if (!response.ok) return;

    // Nothing running is a settled state, not an error.
    if (!response.headers?.get('content-type')?.includes('text/event-stream')) {
      const body = await readJson(response);
      if (body) onEvent({ ...body, type: 'resume' });
      return;
    }

    if (response.body) await readEventStream(response.body, onEvent);
  } catch {
    // A reconnect that cannot connect says nothing. The learner did not ask
    // for it, and an error about a request they never made is noise.
  }
}
