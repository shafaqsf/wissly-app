import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

vi.mock('@/lib/actions/conversation', () => ({
  newThreadAction: vi.fn(),
  openThreadAction: vi.fn(),
  listThreadsAction: vi.fn(),
  renameThreadAction: vi.fn(),
  pinThreadAction: vi.fn(),
  archiveThreadAction: vi.fn(),
  restoreThreadAction: vi.fn(),
  deleteThreadAction: vi.fn(),
  withdrawMessageAction: vi.fn(),
  stopThreadAction: vi.fn(),
  resumeThreadAction: vi.fn(),
  runActionsAction: vi.fn(),
  undoRunAction: vi.fn(),
  undoLastChangeAction: vi.fn(),
  listStandingOrdersAction: vi.fn(),
  createStandingOrderAction: vi.fn(),
  updateStandingOrderAction: vi.fn(),
  setStandingOrderEnabledAction: vi.fn(),
  deleteStandingOrderAction: vi.fn(),
}));

import * as actions from '@/lib/actions/conversation';

import AgentDock from './agent-dock';

const FIELD = /ask about your material/i;
const conversation = { id: 'c1', title: 'Measure theory', mode: 'chat' };

/** A stream that plays a script of events and then ends, like the route does. */
function scripted(events) {
  return vi.fn(async ({ onEvent }) => {
    for (const event of events) onEvent(event);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  actions.newThreadAction.mockResolvedValue({ conversation });
  actions.openThreadAction.mockResolvedValue({ conversation, messages: [] });
  actions.listThreadsAction.mockResolvedValue({ threads: [] });
  actions.resumeThreadAction.mockResolvedValue({ messages: [], running: null, queued: [] });
  actions.listStandingOrdersAction.mockResolvedValue({ orders: [] });
});

async function send(user, text, stream) {
  render(<AgentDock conversation={conversation} stream={stream} />);
  await user.type(screen.getByLabelText(FIELD), text);
  await user.click(screen.getByRole('button', { name: /^send$/i }));
}

describe('the agent dock', () => {
  it('starts a conversation only when there is not one already', async () => {
    const user = userEvent.setup();
    const open = scripted([{ type: 'done', content: 'ok' }]);
    await send(user, 'hello', { open });

    expect(actions.newThreadAction).not.toHaveBeenCalled();
    expect(open.mock.calls[0][0].conversationId).toBe('c1');
  });

  it('opens a thread on the first message when there is none', async () => {
    const user = userEvent.setup();
    const open = scripted([{ type: 'done', content: 'ok' }]);
    render(<AgentDock stream={{ open }} />);

    await user.type(screen.getByLabelText(FIELD), 'hello');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => expect(actions.newThreadAction).toHaveBeenCalled());
    await waitFor(() => expect(open.mock.calls[0][0].conversationId).toBe('c1'));
  });

  /* The learner reads their own words back straight away rather than watching
     an empty panel while a round trip happens. */
  it('puts the message on the screen before the server has answered', async () => {
    const user = userEvent.setup();
    const open = vi.fn(() => new Promise(() => {}));
    await send(user, 'what is a ring?', { open });

    expect(await screen.findByText('what is a ring?')).toBeInTheDocument();
  });

  /* The persisted row is the truth about a message: its id is what a withdraw
     is aimed at, so the optimistic row is replaced rather than kept beside it. */
  it('replaces the message it drew with the one the server started', async () => {
    const user = userEvent.setup();
    const open = scripted([
      { type: 'start', message: { id: 'm1', role: 'user', content: 'what is a ring?', status: 'running' } },
      { type: 'done', content: 'A set with two operations.' },
    ]);
    await send(user, 'what is a ring?', { open });

    await waitFor(() => expect(screen.getAllByText('what is a ring?')).toHaveLength(1));
  });

  it('writes the deltas into the answer as they land', async () => {
    const user = userEvent.setup();
    const open = scripted([
      { type: 'start', message: { id: 'm1', role: 'user', content: 'x', status: 'running' } },
      { type: 'delta', text: 'A set ' },
      { type: 'delta', text: 'with two operations.' },
      { type: 'done', content: 'A set with two operations.' },
    ]);
    await send(user, 'x', { open });

    expect(await screen.findByText('A set with two operations.')).toBeInTheDocument();
  });

  /* A 202 means a run was already in flight: the row is stored `queued` and
     comes back whole, and it is rendered as waiting rather than as an answer. */
  it('renders a queued message as waiting, with its real id', async () => {
    const user = userEvent.setup();
    const open = scripted([
      { type: 'queued', queued: true, message: { id: 'm9', role: 'user', content: 'and then?', status: 'queued' } },
    ]);
    await send(user, 'and then?', { open });

    expect(await screen.findByTestId('meta-m9')).toHaveTextContent(/waiting/i);
  });

  it('withdraws a waiting message by the id the server gave it', async () => {
    const user = userEvent.setup();
    actions.withdrawMessageAction.mockResolvedValue({ withdrawn: true });
    const open = scripted([
      { type: 'queued', queued: true, message: { id: 'm9', role: 'user', content: 'and then?', status: 'queued' } },
    ]);
    await send(user, 'and then?', { open });

    await user.click(await screen.findByRole('button', { name: /withdraw/i }));

    expect(actions.withdrawMessageAction).toHaveBeenCalledWith({
      conversationId: 'c1',
      id: 'm9',
    });
  });

  it('stops the running turn and leaves what is waiting alone', async () => {
    const user = userEvent.setup();
    actions.stopThreadAction.mockResolvedValue({ stopped: [] });
    const open = vi.fn(() => new Promise(() => {}));
    await send(user, 'a long one', { open });

    await user.click(await screen.findByRole('button', { name: /^stop$/i }));

    expect(actions.stopThreadAction).toHaveBeenCalledWith({ conversationId: 'c1' });
    expect(actions.withdrawMessageAction).not.toHaveBeenCalled();
  });

  /* A run that dies halfway must report what completed, or Undo is guesswork. */
  it('reports what got through when a run fails halfway', async () => {
    const user = userEvent.setup();
    const open = scripted([
      { type: 'start', message: { id: 'm1', role: 'user', content: 'x', status: 'running' } },
      {
        type: 'failed',
        content: 'The model stopped answering.',
        completed: ['a course “Measure theory”', '8 cards'],
      },
    ]);
    await send(user, 'x', { open });

    expect(await screen.findByText(/before it stopped it completed/i)).toHaveTextContent(/8 cards/);
  });

  /* "I made you eight cards" is worse than landing on them — and a silent page
     change is disorienting, so the move is performed and then said. */
  it('performs a navigation intent with the router and says where it went', async () => {
    const user = userEvent.setup();
    const open = scripted([
      { type: 'start', message: { id: 'm1', role: 'user', content: 'x', status: 'running' } },
      {
        type: 'intent',
        intent: { kind: 'navigate', path: '/courses/abc', query: { type: 'card' }, label: 'the course' },
      },
      { type: 'done', content: 'Made you eight cards.' },
    ]);
    await send(user, 'x', { open });

    await waitFor(() => expect(push).toHaveBeenCalledWith('/courses/abc?type=card'));
    expect(await screen.findByText(/opened the course/i)).toBeInTheDocument();
  });

  it('touches the DOM for no navigation, only the router', async () => {
    const user = userEvent.setup();
    const open = scripted([
      { type: 'intent', intent: { kind: 'navigate', path: '/tasks', query: {}, label: 'your tasks' } },
      { type: 'done', content: 'Done.' },
    ]);
    await send(user, 'x', { open });

    await waitFor(() => expect(push).toHaveBeenCalledWith('/tasks'));
  });

  it('takes the last change back when the learner asks', async () => {
    const user = userEvent.setup();
    actions.undoLastChangeAction.mockResolvedValue({ message: 'Took back 8 changes.', undone: ['a'], failed: [] });
    const open = scripted([
      { type: 'start', message: { id: 'm1', role: 'user', content: 'x', status: 'running', mode: 'agent' } },
      { type: 'done', content: 'Made you eight cards.' },
    ]);
    render(<AgentDock conversation={{ ...conversation, mode: 'agent' }} stream={{ open }} />);

    await user.type(screen.getByLabelText(FIELD), 'x');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    await user.click(await screen.findByRole('button', { name: /take these changes back/i }));

    expect(actions.undoLastChangeAction).toHaveBeenCalledWith({ conversationId: 'c1' });
    expect(await screen.findByText(/took back 8 changes/i)).toBeInTheDocument();
  });

  /* A run named by id is undone by name, and what it left behind is counted
     first so the learner reads a number rather than a promise. */
  it('counts what a named run left outstanding, and undoes that run by name', async () => {
    const user = userEvent.setup();
    actions.runActionsAction.mockResolvedValue({ actions: [], outstanding: 3 });
    actions.undoRunAction.mockResolvedValue({ message: 'Took back 3 changes.', undone: ['a'], failed: [] });
    const open = scripted([
      { type: 'start', message: { id: 'm1', role: 'user', content: 'x', status: 'running' } },
      { type: 'done', content: 'Made you three cards.', runId: 'r1' },
    ]);
    render(<AgentDock conversation={{ ...conversation, mode: 'agent' }} stream={{ open }} />);

    await user.type(screen.getByLabelText(FIELD), 'x');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => expect(actions.runActionsAction).toHaveBeenCalledWith({ runId: 'r1' }));
    expect(await screen.findByText(/3 changes/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /take these changes back/i }));

    expect(actions.undoRunAction).toHaveBeenCalledWith({ runId: 'r1' });
  });

  /* The one that matters. Two runs in one thread, and Undo pressed on the
     older message. An undo that reaches the newer run is worse than no undo:
     it reverses writes the learner never asked to lose and leaves the ones
     they did. */
  it('undoes the run the message caused, not the newest run in the thread', async () => {
    const user = userEvent.setup();
    actions.runActionsAction.mockResolvedValue({ actions: [], outstanding: 2 });
    actions.undoRunAction.mockResolvedValue({
      message: 'Took back 2 changes.',
      undone: ['a', 'b'],
      failed: [],
    });
    const open = scripted([
      { type: 'start', message: { id: 'm1', role: 'user', content: 'first', status: 'running' } },
      { type: 'done', content: 'Made the first two.', runId: 'r1' },
      { type: 'start', message: { id: 'm2', role: 'user', content: 'second', status: 'running' } },
      { type: 'done', content: 'Made the second two.', runId: 'r2' },
    ]);
    render(<AgentDock conversation={{ ...conversation, mode: 'agent' }} stream={{ open }} />);

    await user.type(screen.getByLabelText(FIELD), 'x');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /take these changes back/i })).toHaveLength(2),
    );

    await user.click(screen.getAllByRole('button', { name: /take these changes back/i })[0]);

    expect(actions.undoRunAction).toHaveBeenCalledWith({ runId: 'r1' });
    expect(actions.undoLastChangeAction).not.toHaveBeenCalled();
  });

  /* A chat turn changes nothing, so naming its run must not put an undo
     affordance under an answer that has nothing to take back. */
  it('offers no undo for a chat turn, run id or not', async () => {
    const user = userEvent.setup();
    actions.runActionsAction.mockResolvedValue({ actions: [], outstanding: 0 });
    const open = scripted([
      { type: 'start', message: { id: 'm1', role: 'user', content: 'x', status: 'running' } },
      { type: 'done', content: 'A fair game.', runId: 'r1' },
    ]);
    await send(user, 'x', { open });

    expect(await screen.findByText('A fair game.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /take these changes back/i }),
    ).not.toBeInTheDocument();
    expect(actions.runActionsAction).not.toHaveBeenCalled();
  });

  /* A reconnected stream that ends after the five-minute cap, or one whose
     terminal frame carries no name, still knows the run it rejoined. */
  it('remembers the run named on the resume frame when the end does not name it', async () => {
    const user = userEvent.setup();
    actions.runActionsAction.mockResolvedValue({ actions: [], outstanding: 4 });
    actions.undoRunAction.mockResolvedValue({ message: 'Took back 4 changes.', undone: ['a'], failed: [] });
    const reconnect = scripted([
      {
        type: 'resume',
        runId: 'r5',
        message: { id: 'a1', role: 'assistant', content: 'Hel', status: 'running' },
        messages: [{ id: 'a1', role: 'assistant', content: 'Hel', status: 'running' }],
      },
      { type: 'done', content: 'Hello.' },
    ]);
    render(
      <AgentDock
        conversation={{ ...conversation, mode: 'agent' }}
        stream={{ open: vi.fn(), reconnect }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /take these changes back/i }));

    expect(actions.undoRunAction).toHaveBeenCalledWith({ runId: 'r5' });
  });

  it('rejoins a run already in flight when it mounts', async () => {
    const reconnect = scripted([]);
    render(<AgentDock conversation={conversation} stream={{ open: vi.fn(), reconnect }} />);

    await waitFor(() => expect(reconnect.mock.calls[0][0].conversationId).toBe('c1'));
  });

  it('renders a rewritten row whole rather than appending to it', async () => {
    const reconnect = scripted([
      {
        type: 'resume',
        message: { id: 'm2', role: 'assistant', content: 'A set with', status: 'running' },
        messages: [{ id: 'm1', role: 'user', content: 'x', status: 'done' }],
        queued: [],
      },
      { type: 'failed', content: 'The model stopped answering.', completed: [] },
    ]);
    render(<AgentDock conversation={conversation} stream={{ open: vi.fn(), reconnect }} />);

    expect(await screen.findByText('The model stopped answering.')).toBeInTheDocument();
    expect(screen.queryByText(/A set with/)).toBeNull();
  });

  describe('the conversations', () => {
    it('loads the history when the list is opened', async () => {
      const user = userEvent.setup();
      actions.listThreadsAction.mockResolvedValue({ threads: [{ id: 't2', title: 'Rings' }] });
      render(<AgentDock conversation={conversation} stream={{ open: vi.fn() }} />);

      await user.click(screen.getByLabelText(FIELD));
      await user.click(screen.getByRole('button', { name: /conversations/i }));

      expect(await screen.findByRole('button', { name: /rings/i })).toBeInTheDocument();
    });

    it('opens the conversation that was chosen', async () => {
      const user = userEvent.setup();
      actions.listThreadsAction.mockResolvedValue({ threads: [{ id: 't2', title: 'Rings' }] });
      actions.openThreadAction.mockResolvedValue({
        conversation: { id: 't2', title: 'Rings', mode: 'chat' },
        messages: [{ id: 'x1', role: 'user', content: 'about rings', status: 'done' }],
      });
      render(<AgentDock conversation={conversation} stream={{ open: vi.fn() }} />);

      await user.click(screen.getByLabelText(FIELD));
      await user.click(screen.getByRole('button', { name: /conversations/i }));
      await user.click(await screen.findByRole('button', { name: /rings/i }));

      expect(actions.openThreadAction).toHaveBeenCalledWith({ id: 't2' });
      expect(await screen.findByText('about rings')).toBeInTheDocument();
    });

    it('archives and reloads the list', async () => {
      const user = userEvent.setup();
      actions.listThreadsAction.mockResolvedValue({ threads: [{ id: 't2', title: 'Rings' }] });
      actions.archiveThreadAction.mockResolvedValue({ conversation: {} });
      render(<AgentDock conversation={conversation} stream={{ open: vi.fn() }} />);

      await user.click(screen.getByLabelText(FIELD));
      await user.click(screen.getByRole('button', { name: /conversations/i }));
      await user.click(await screen.findByRole('button', { name: /^archive$/i }));

      expect(actions.archiveThreadAction).toHaveBeenCalledWith({ id: 't2' });
      await waitFor(() => expect(actions.listThreadsAction).toHaveBeenCalledTimes(2));
    });

    it('reads the archive when it is asked for', async () => {
      const user = userEvent.setup();
      render(<AgentDock conversation={conversation} stream={{ open: vi.fn() }} />);

      await user.click(screen.getByLabelText(FIELD));
      await user.click(screen.getByRole('button', { name: /conversations/i }));
      await user.click(await screen.findByRole('button', { name: /show archive/i }));

      await waitFor(() =>
        expect(actions.listThreadsAction).toHaveBeenCalledWith({ archived: true }),
      );
    });
  });

  describe('the standing orders', () => {
    it('loads them when the surface is opened', async () => {
      const user = userEvent.setup();
      actions.listStandingOrdersAction.mockResolvedValue({
        orders: [{ id: 'o1', instruction: 'Plan my week', schedule: 'weekly', enabled: true }],
      });
      render(<AgentDock conversation={conversation} stream={{ open: vi.fn() }} />);

      await user.click(screen.getByLabelText(FIELD));
      await user.click(screen.getByRole('button', { name: /standing orders/i }));

      expect(await screen.findByText(/plan my week/i)).toBeInTheDocument();
    });

    it('creates one and reloads', async () => {
      const user = userEvent.setup();
      actions.createStandingOrderAction.mockResolvedValue({ order: { id: 'o2' } });
      render(<AgentDock conversation={conversation} stream={{ open: vi.fn() }} />);

      await user.click(screen.getByLabelText(FIELD));
      await user.click(screen.getByRole('button', { name: /standing orders/i }));

      await user.type(await screen.findByLabelText(/what should the agent do/i), 'Plan my week');
      await user.type(screen.getByLabelText(/how often/i), 'weekly');
      await user.click(screen.getByRole('button', { name: /add standing order/i }));

      expect(actions.createStandingOrderAction).toHaveBeenCalledWith({
        instruction: 'Plan my week',
        schedule: 'weekly',
      });
    });
  });

  it('says what broke, in the words that came back', async () => {
    const user = userEvent.setup();
    const open = scripted([{ type: 'failed', content: 'The agent could not be reached.', completed: [] }]);
    await send(user, 'x', { open });

    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument();
  });
});
