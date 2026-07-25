import { describe, expect, it, vi } from 'vitest';

import { openStream, readEventStream, reconnect } from './agent-stream';

/** A ReadableStream is what `fetch` hands back; jsdom has the constructor. */
function bodyOf(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('readEventStream', () => {
  it('reads one frame as its event type and its parsed data', async () => {
    const events = [];

    await readEventStream(bodyOf(['event: delta\ndata: {"text":"Hi"}\n\n']), (event) =>
      events.push(event),
    );

    expect(events).toEqual([{ type: 'delta', text: 'Hi' }]);
  });

  it('reads a frame split across chunks', async () => {
    const events = [];

    await readEventStream(bodyOf(['event: del', 'ta\ndata: {"text', '":"Hi"}\n\n']), (event) =>
      events.push(event),
    );

    expect(events).toEqual([{ type: 'delta', text: 'Hi' }]);
  });

  it('reads several frames from one chunk, in order', async () => {
    const events = [];

    await readEventStream(
      bodyOf([
        'event: delta\ndata: {"text":"a"}\n\nevent: delta\ndata: {"text":"b"}\n\nevent: done\ndata: {"content":"ab"}\n\n',
      ]),
      (event) => events.push(event),
    );

    expect(events.map((event) => event.type)).toEqual(['delta', 'delta', 'done']);
    expect(events.at(-1).content).toBe('ab');
  });

  /* A failed run names what landed before it died. Dropping that frame is how
     Undo becomes guesswork — see "A failure state" in the four-areas spec. */
  it('keeps the list of what completed on a failed frame', async () => {
    const events = [];

    await readEventStream(
      bodyOf(['event: failed\ndata: {"content":"Ran out","completed":["a course","3 cards"]}\n\n']),
      (event) => events.push(event),
    );

    expect(events[0]).toEqual({
      type: 'failed',
      content: 'Ran out',
      completed: ['a course', '3 cards'],
    });
  });

  it('ignores comment lines and blank keep-alives', async () => {
    const events = [];

    await readEventStream(bodyOf([': keep-alive\n\n', 'event: done\ndata: {}\n\n']), (event) =>
      events.push(event),
    );

    expect(events).toEqual([{ type: 'done' }]);
  });

  it('survives a frame whose data is not JSON rather than ending the stream', async () => {
    const events = [];

    await readEventStream(bodyOf(['event: delta\ndata: not json\n\nevent: done\ndata: {}\n\n']), (event) =>
      events.push(event),
    );

    expect(events.map((event) => event.type)).toEqual(['done']);
  });
});

describe('openStream', () => {
  const response = (chunks) => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: bodyOf(chunks),
  });

  const json = (status, payload) => ({
    ok: status < 400,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => payload,
  });

  it('posts what the bar chose and reads the answer back', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(['event: done\ndata: {"content":"ok"}\n\n']));
    const events = [];

    await openStream({
      conversationId: 'c1',
      content: 'hello',
      mode: 'agent',
      model: 'anthropic/claude-sonnet-5',
      onEvent: (event) => events.push(event),
      fetchImpl,
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/agent/stream');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      conversationId: 'c1',
      content: 'hello',
      mode: 'agent',
      model: 'anthropic/claude-sonnet-5',
    });
    expect(events).toEqual([{ type: 'done', content: 'ok' }]);
  });

  /* The persisted row is the truth about the message, id and status included.
     Inventing an id on the client and reconciling it later is how a withdraw
     ends up aimed at a row that never existed. */
  it('passes the started user message through as its first event', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        response([
          'event: start\ndata: {"conversationId":"c1","message":{"id":"m1","status":"running"}}\n\n',
          'event: done\ndata: {"content":"ok"}\n\n',
        ]),
      );
    const events = [];

    await openStream({ conversationId: 'c1', content: 'x', onEvent: (e) => events.push(e), fetchImpl });

    expect(events[0]).toEqual({
      type: 'start',
      conversationId: 'c1',
      message: { id: 'm1', status: 'running' },
    });
  });

  /* The queue drains on the same stream, bounded at ten, so a second turn can
     finish after the first. A reader that tore down on the first terminal
     frame would silently drop everything the learner queued. */
  it('keeps reading past a terminal frame, because the queue drains on the same stream', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        response([
          'event: done\ndata: {"content":"first"}\n\n',
          'event: start\ndata: {"message":{"id":"m2"}}\n\n',
          'event: done\ndata: {"content":"second"}\n\n',
        ]),
      );
    const events = [];

    await openStream({ conversationId: 'c1', content: 'x', onEvent: (e) => events.push(e), fetchImpl });

    expect(events.map((event) => event.type)).toEqual(['done', 'start', 'done']);
    expect(events.at(-1).content).toBe('second');
  });

  /* A run already in flight answers 202 and no stream opens at all: the
     message is stored `queued` and the row comes back as JSON. */
  it('reports a queued message from the 202 rather than opening a stream', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(json(202, { queued: true, message: { id: 'm9', status: 'queued' } }));
    const events = [];

    await openStream({ conversationId: 'c1', content: 'x', onEvent: (e) => events.push(e), fetchImpl });

    expect(events).toEqual([
      { type: 'queued', queued: true, message: { id: 'm9', status: 'queued' } },
    ]);
  });

  /* The learner is told what broke in words, in the thread, rather than left
     with a bar that quietly stopped answering. */
  it('reports a refused request as a failed event, in the words the server used', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(json(400, { error: 'That is not an OpenRouter model id.' }));
    const events = [];

    await openStream({ conversationId: 'c1', content: 'x', onEvent: (e) => events.push(e), fetchImpl });

    expect(events[0].type).toBe('failed');
    expect(events[0].content).toBe('That is not an OpenRouter model id.');
  });

  it('falls back to its own words when a refusal carries none', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Headers() });
    const events = [];

    await openStream({ conversationId: 'c1', content: 'x', onEvent: (e) => events.push(e), fetchImpl });

    expect(events[0].type).toBe('failed');
    expect(events[0].content).toMatch(/again/i);
  });

  it('reports a dropped connection as a failed event', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const events = [];

    await openStream({ conversationId: 'c1', content: 'x', onEvent: (e) => events.push(e), fetchImpl });

    expect(events[0].type).toBe('failed');
  });

  it('says nothing about an abort, because the learner asked for it', async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    const fetchImpl = vi.fn().mockRejectedValue(error);
    const events = [];

    await openStream({ conversationId: 'c1', content: 'x', onEvent: (e) => events.push(e), fetchImpl });

    expect(events).toEqual([]);
  });
});

describe('reconnect', () => {
  const stream = (chunks) => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: bodyOf(chunks),
  });

  /* Nothing running is a settled state, not an error: the thread is handed
     back whole and the bar renders it. */
  it('reads a settled thread back as JSON without opening a stream', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ running: null, messages: [{ id: 'm1' }], queued: [] }),
    });
    const events = [];

    await reconnect({ conversationId: 'c1', onEvent: (e) => events.push(e), fetchImpl });

    expect(fetchImpl.mock.calls[0][0]).toBe('/api/agent/stream?conversationId=c1');
    expect(events).toEqual([
      { type: 'resume', running: null, messages: [{ id: 'm1' }], queued: [] },
    ]);
  });

  it('rejoins a run in flight from its resume frame', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      stream([
        'event: resume\ndata: {"conversationId":"c1","message":{"id":"m2","content":"A col"},"messages":[],"queued":[]}\n\n',
        'event: delta\ndata: {"text":"lection"}\n\n',
        'event: done\ndata: {"content":"A collection"}\n\n',
      ]),
    );
    const events = [];

    await reconnect({ conversationId: 'c1', onEvent: (e) => events.push(e), fetchImpl });

    expect(events.map((event) => event.type)).toEqual(['resume', 'delta', 'done']);
  });

  it('says nothing at all when the reconnect itself fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const events = [];

    await reconnect({ conversationId: 'c1', onEvent: (e) => events.push(e), fetchImpl });

    expect(events).toEqual([]);
  });
});
