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
    expect(container.querySelector('.grain')).not.toHaveClass('grain-working');
  });

  it('sets no inline grain, because the state class carries both axes', async () => {
    const user = userEvent.setup();
    const { container } = render(<AgentBar working />);

    await user.click(screen.getByLabelText(/ask about your material/i));

    // A surface that names its grain separately from its colour can say one
    // thing with its texture and another with its hue.
    expect(container.querySelector('.grain').style.getPropertyValue('--grain')).toBe('');
  });

  it('keeps the field off the form, because a field sits beside one, never behind', async () => {
    const user = userEvent.setup();
    const { container } = render(<AgentBar working />);

    await user.click(screen.getByLabelText(/ask about your material/i));

    expect(container.querySelector('form').closest('.grain-field')).toBeNull();
  });

  it('tells the page behind it to stand down, so only one field carries state', () => {
    const { rerender } = render(<AgentBar working />);
    expect(document.body.dataset.agentWorking).toBe('true');

    rerender(<AgentBar working={false} />);
    expect(document.body.dataset.agentWorking).toBe('false');
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

describe('the field the bar paints', () => {
  it('names the state it encodes, so it is never colour for its own sake', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<AgentBar working />);

    await user.click(screen.getByLabelText(/ask about your material/i));
    expect(container.querySelector('.grain-field')).toHaveClass('field-unresolved');

    rerender(<AgentBar working={false} />);
    expect(container.querySelector('.grain-field')).toHaveClass('field-settled');
  });
});
