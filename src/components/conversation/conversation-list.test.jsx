import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ConversationList from './conversation-list';

const thread = (over = {}) => ({
  id: 't1',
  title: 'Measure theory',
  mode: 'chat',
  pinned_at: null,
  archived_at: null,
  last_message_at: '2026-07-24T10:00:00Z',
  ...over,
});

describe('the conversation list', () => {
  it('invites the learner to start rather than apologising for being empty', () => {
    render(<ConversationList threads={[]} />);

    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
  });

  it('puts pinned conversations first, then the recent ones', () => {
    render(
      <ConversationList
        threads={[
          thread({ id: 'a', title: 'Recent one' }),
          thread({ id: 'b', title: 'Pinned one', pinned_at: '2026-07-20T00:00:00Z' }),
        ]}
      />,
    );

    const titles = screen.getAllByTestId(/^thread-/).map((row) => row.textContent);
    expect(titles[0]).toMatch(/Pinned one/);
    expect(titles[1]).toMatch(/Recent one/);
    expect(screen.getByText(/^Pinned$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Recent$/i)).toBeInTheDocument();
  });

  it('names an untitled conversation rather than showing a blank row', () => {
    render(<ConversationList threads={[thread({ title: null })]} />);

    expect(screen.getByTestId('thread-t1')).toHaveTextContent(/untitled conversation/i);
  });

  it('opens the conversation that was chosen', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<ConversationList threads={[thread()]} onOpen={onOpen} />);

    await user.click(screen.getByRole('button', { name: /measure theory/i }));

    expect(onOpen).toHaveBeenCalledWith('t1');
  });

  it('marks which conversation is open', () => {
    render(<ConversationList threads={[thread()]} openId="t1" />);

    expect(screen.getByRole('button', { name: /measure theory/i })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('starts a new conversation', async () => {
    const user = userEvent.setup();
    const onNew = vi.fn();
    render(<ConversationList threads={[]} onNew={onNew} />);

    await user.click(screen.getByRole('button', { name: /new conversation/i }));

    expect(onNew).toHaveBeenCalled();
  });

  it('pins and unpins with the same control, saying which it will do', async () => {
    const user = userEvent.setup();
    const onPin = vi.fn();
    const { rerender } = render(<ConversationList threads={[thread()]} onPin={onPin} />);

    await user.click(screen.getByRole('button', { name: /^pin/i }));
    expect(onPin).toHaveBeenCalledWith('t1', true);

    rerender(
      <ConversationList threads={[thread({ pinned_at: '2026-07-20T00:00:00Z' })]} onPin={onPin} />,
    );
    await user.click(screen.getByRole('button', { name: /^unpin/i }));
    expect(onPin).toHaveBeenCalledWith('t1', false);
  });

  it('renames a conversation in place', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<ConversationList threads={[thread()]} onRename={onRename} />);

    await user.click(screen.getByRole('button', { name: /rename/i }));

    const field = screen.getByLabelText(/conversation name/i);
    await user.clear(field);
    await user.type(field, 'Sigma algebras');
    await user.click(screen.getByRole('button', { name: /save name/i }));

    expect(onRename).toHaveBeenCalledWith('t1', 'Sigma algebras');
  });

  it('archives rather than destroying', async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn();
    render(<ConversationList threads={[thread()]} onArchive={onArchive} />);

    await user.click(screen.getByRole('button', { name: /^archive$/i }));

    expect(onArchive).toHaveBeenCalledWith('t1');
  });

  /* The one irreversible act. Reachable from the archive, and nowhere else. */
  it('offers no delete outside the archive', () => {
    render(<ConversationList threads={[thread()]} onDelete={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('restores and deletes from the archive', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const onDelete = vi.fn();
    render(
      <ConversationList
        archived
        threads={[thread({ archived_at: '2026-07-22T00:00:00Z' })]}
        onRestore={onRestore}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: /restore/i }));
    expect(onRestore).toHaveBeenCalledWith('t1');

    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/cannot be undone/i);

    await user.click(screen.getByRole('button', { name: /delete for good/i }));
    expect(onDelete).toHaveBeenCalledWith('t1');
  });

  it('switches between the open conversations and the archive', async () => {
    const user = userEvent.setup();
    const onShowArchived = vi.fn();
    render(<ConversationList threads={[]} onShowArchived={onShowArchived} />);

    await user.click(screen.getByRole('button', { name: /show archive/i }));

    expect(onShowArchived).toHaveBeenCalledWith(true);
  });

  it('staggers the list as it arrives', () => {
    render(<ConversationList threads={[thread()]} />);

    expect(screen.getByRole('list').className).toMatch(/motion-stagger/);
  });

  it('wears no brand mark, because the bar carries the only one', () => {
    const { container } = render(<ConversationList threads={[thread()]} />);

    expect(container.querySelectorAll('[data-brand-mark]')).toHaveLength(0);
  });
});
