import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import AgentBar from './agent-bar';

describe('the agent bar', () => {
  it('starts as one line and lifts into a panel when the field takes focus', async () => {
    const user = userEvent.setup();
    render(<AgentBar />);

    expect(screen.queryByText(/answers come from your material/i)).toBeNull();

    await user.click(screen.getByLabelText(/ask about your material/i));

    expect(screen.getByText(/answers come from your material/i)).toBeInTheDocument();
  });

  /* The mark is who is speaking. It sits once, in the panel header, rather
     than on every turn — a column of the same coloured mark would read as
     texture, which is the one thing the design language will not have. */
  it('wears the brand mark once the agent panel is open', async () => {
    const user = userEvent.setup();
    const { container } = render(<AgentBar />);

    expect(container.querySelector('[data-brand-mark]')).toBeNull();

    await user.click(screen.getByLabelText(/ask about your material/i));

    const marks = container.querySelectorAll('[data-brand-mark]');
    expect(marks).toHaveLength(1);
    // Decorative: the header already names the agent in words beside it.
    expect(marks[0]).toHaveAttribute('alt', '');
  });

  it('offers both modes and opens in the one that changes nothing', () => {
    render(<AgentBar />);

    expect(screen.getByRole('radio', { name: /chat/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /agent/i })).not.toBeChecked();
  });

  it('says what agent mode means before the learner picks it', () => {
    render(<AgentBar />);

    expect(screen.getByRole('radio', { name: /agent/i })).toHaveAttribute(
      'title',
      expect.stringMatching(/undone/i),
    );
  });

  it('sends what was typed, in the mode that was chosen', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue({});
    render(<AgentBar onSend={onSend} />);

    await user.click(screen.getByRole('radio', { name: /agent/i }));
    await user.type(
      screen.getByLabelText(/ask about your material/i),
      'make cards for chapter 3',
    );
    // The placeholder follows the mode; the label does not, because a label
    // that moves is a label a screen reader user has to re-learn.
    expect(screen.getByLabelText(/ask about your material/i)).toHaveAttribute(
      'placeholder',
      'Tell the agent what to do',
    );
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    expect(onSend).toHaveBeenCalledWith({
      content: 'make cards for chapter 3',
      mode: 'agent',
    });
  });

  it('clears the field immediately, so a second message can follow the first', async () => {
    const user = userEvent.setup();
    let release;
    const onSend = vi.fn(() => new Promise((resolve) => (release = resolve)));
    render(<AgentBar onSend={onSend} />);

    const field = screen.getByLabelText(/ask about your material/i);
    await user.type(field, 'first{Enter}');

    expect(field).toHaveValue('');
    release?.({});
  });

  it('will not send an empty message', async () => {
    render(<AgentBar onSend={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^send$/i })).toBeDisabled();
  });

  it('reports a refusal in words, where the learner is looking', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue({ error: 'That is too long for a message.' });
    render(<AgentBar onSend={onSend} />);

    await user.type(screen.getByLabelText(/ask about your material/i), 'x{Enter}');

    expect(await screen.findByRole('status')).toHaveTextContent(/too long/i);
  });

  it('offers a stop rather than a send while the agent works', () => {
    render(<AgentBar working messages={[{ id: 'm1', role: 'user', content: 'hi' }]} />);

    expect(screen.getByRole('button', { name: /stop the agent/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^send$/i })).toBeNull();
  });

  it('says how many messages are waiting rather than blocking the field', () => {
    render(
      <AgentBar
        working
        messages={[
          { id: 'm1', role: 'user', content: 'one', status: 'running' },
          { id: 'm2', role: 'user', content: 'two', status: 'queued' },
          { id: 'm3', role: 'user', content: 'three', status: 'queued' },
        ]}
      />,
    );

    expect(screen.getByText('2 waiting')).toBeInTheDocument();
    expect(screen.getByLabelText(/ask about your material/i)).toBeEnabled();
  });

  it('drifts while working and stops drifting when the answer lands', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<AgentBar working />);

    await user.click(screen.getByLabelText(/ask about your material/i));
    expect(container.querySelector('.grain')).toHaveClass('grain-working');

    rerender(<AgentBar working={false} />);
    expect(container.querySelector('.grain')).toBeNull();
  });

  /* The transcript used to be a tinted surface while a run was in flight, and
     the answer then had to be read on top of it. Nothing in the bar paints a
     background any more — see "The field" in docs/DESIGN.md. */
  it('paints no background, however long the run takes', async () => {
    const user = userEvent.setup();
    const { container } = render(<AgentBar working />);

    await user.click(screen.getByLabelText(/ask about your material/i));

    expect(container.querySelector('.grain-field, .grain-wash')).toBeNull();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<AgentBar />);

    await user.click(screen.getByLabelText(/ask about your material/i));
    expect(screen.getByText(/answers come from your material/i)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText(/answers come from your material/i)).toBeNull();
  });
});

describe('the mark the bar wears', () => {
  /* The state sits on the thing that has it, beside the word that names it.
     A mark with no word next to it would be a dot nobody can read. */
  it('marks the run beside the word that names it', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<AgentBar working />);

    await user.click(screen.getByLabelText(/ask about your material/i));

    const mark = container.querySelector('.grain-mark');
    expect(mark).toHaveClass('field-unresolved');
    expect(mark.parentElement).toHaveTextContent('Working');

    rerender(<AgentBar working={false} />);
    expect(container.querySelector('.grain-mark')).toBeNull();
    expect(screen.getByText('Your material')).toBeInTheDocument();
  });
});

describe('taking a change back', () => {
  it('offers undo only when there is something to take back', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AgentBar canUndo={false} />);

    await user.click(screen.getByLabelText(/ask about your material/i));
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();

    rerender(<AgentBar canUndo />);
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
  });

  it('hides undo while the agent is still working', async () => {
    const user = userEvent.setup();
    render(<AgentBar canUndo working />);

    await user.click(screen.getByLabelText(/ask about your material/i));
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
  });

  it('says what came back, so a silent undo is never mistaken for none', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn().mockResolvedValue({ message: 'Took back 2 changes.' });
    render(<AgentBar canUndo onUndo={onUndo} />);

    await user.click(screen.getByLabelText(/ask about your material/i));
    await user.click(screen.getByRole('button', { name: /undo/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Took back 2 changes.');
  });
});
