import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import AgentBar from './agent-bar';

const FIELD = /ask about your material/i;

const said = (over = {}) => ({
  id: 'm1',
  role: 'user',
  content: 'What is a σ-algebra?',
  status: 'done',
  mode: 'chat',
  model: null,
  ...over,
});

describe('the agent bar', () => {
  it('starts as one line and lifts into a panel when the field takes focus', async () => {
    const user = userEvent.setup();
    render(<AgentBar />);

    expect(screen.queryByText(/answers come from your material/i)).toBeNull();

    await user.click(screen.getByLabelText(FIELD));

    expect(screen.getByText(/answers come from your material/i)).toBeInTheDocument();
  });

  /* The lift is a transform and never a height: animating layout re-flows the
     page on every frame and the text reflows while it is being read. */
  it('lifts with the named slide rather than an invented timing', async () => {
    const user = userEvent.setup();
    render(<AgentBar />);

    await user.click(screen.getByLabelText(FIELD));

    expect(screen.getByTestId('agent-panel').className).toMatch(/motion-slide/);
  });

  /* The sidebar gave its mark up, so this is the one place per viewport where
     the product names itself. A second one would be a repetition, and a column
     of the same coloured mark reads as texture. */
  it('wears exactly one brand mark, and only once it is open', async () => {
    const user = userEvent.setup();
    const { container } = render(<AgentBar />);

    expect(container.querySelector('[data-brand-mark]')).toBeNull();

    await user.click(screen.getByLabelText(FIELD));

    const marks = container.querySelectorAll('[data-brand-mark]');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveAttribute('alt', '');
  });

  it('keeps one mark when the history is open too', async () => {
    const user = userEvent.setup();
    const { container } = render(<AgentBar threads={[{ id: 't1', title: 'Measure theory' }]} />);

    await user.click(screen.getByLabelText(FIELD));
    await user.click(screen.getByRole('button', { name: /conversations/i }));

    expect(container.querySelectorAll('[data-brand-mark]')).toHaveLength(1);
  });

  describe('mode and model', () => {
    it('offers both as dropdowns rather than as toggles', () => {
      render(<AgentBar />);

      expect(screen.getByLabelText(/what the agent may do/i).tagName).toBe('SELECT');
      expect(screen.getByLabelText(/which model answers/i).tagName).toBe('SELECT');
      expect(screen.queryByRole('radio')).toBeNull();
    });

    it('sends both with the message, and they are independent of each other', async () => {
      const user = userEvent.setup();
      const onSend = vi.fn().mockResolvedValue({});
      render(<AgentBar onSend={onSend} />);

      await user.selectOptions(screen.getByLabelText(/what the agent may do/i), 'agent');
      await user.selectOptions(
        screen.getByLabelText(/which model answers/i),
        'deepseek/deepseek-v4-pro',
      );
      await user.type(screen.getByLabelText(FIELD), 'make cards for chapter 3');
      await user.click(screen.getByRole('button', { name: /^send$/i }));

      expect(onSend).toHaveBeenCalledWith({
        content: 'make cards for chapter 3',
        mode: 'agent',
        model: 'deepseek/deepseek-v4-pro',
      });
    });

    it('reports the mode outward so the thread can record it', async () => {
      const user = userEvent.setup();
      const onModeChange = vi.fn();
      render(<AgentBar onModeChange={onModeChange} />);

      await user.selectOptions(screen.getByLabelText(/what the agent may do/i), 'agent');

      expect(onModeChange).toHaveBeenCalledWith('agent');
    });

    /* The placeholder follows the mode; the label does not, because a label
       that moves is one a screen reader user has to learn twice. */
    it('changes the placeholder with the mode and leaves the label alone', async () => {
      const user = userEvent.setup();
      render(<AgentBar />);

      await user.selectOptions(screen.getByLabelText(/what the agent may do/i), 'agent');

      expect(screen.getByLabelText(FIELD)).toHaveAttribute(
        'placeholder',
        'Tell the agent what to do',
      );
    });
  });

  describe('the queue', () => {
    /* The field is never taken away: a message sent while a run is in flight is
       written `queued` and rendered immediately. */
    it('keeps the field usable while a run is in flight', () => {
      render(<AgentBar working />);

      expect(screen.getByLabelText(FIELD)).not.toBeDisabled();
    });

    it('sends while working rather than making the learner wait', async () => {
      const user = userEvent.setup();
      const onSend = vi.fn().mockResolvedValue({});
      render(<AgentBar working onSend={onSend} />);

      await user.type(screen.getByLabelText(FIELD), 'and the σ-algebra of what?');
      await user.click(screen.getByRole('button', { name: /^send$/i }));

      expect(onSend).toHaveBeenCalled();
    });

    it('counts what is waiting, in words', async () => {
      const user = userEvent.setup();
      render(
        <AgentBar
          working
          messages={[said({ status: 'queued' }), said({ id: 'm2', status: 'queued' })]}
        />,
      );

      await user.click(screen.getByLabelText(FIELD));

      expect(screen.getByText(/2 waiting/i)).toBeInTheDocument();
    });

    it('passes a withdraw through from the transcript', async () => {
      const user = userEvent.setup();
      const onWithdraw = vi.fn();
      render(<AgentBar working messages={[said({ status: 'queued' })]} onWithdraw={onWithdraw} />);

      await user.click(screen.getByLabelText(FIELD));
      await user.click(screen.getByRole('button', { name: /withdraw/i }));

      expect(onWithdraw).toHaveBeenCalledWith('m1');
    });
  });

  describe('stop', () => {
    it('offers stop beside the field while a run is in flight, and send otherwise', async () => {
      const user = userEvent.setup();
      const onStop = vi.fn();
      const { rerender } = render(<AgentBar working onStop={onStop} />);

      await user.click(screen.getByRole('button', { name: /^stop$/i }));
      expect(onStop).toHaveBeenCalled();

      rerender(<AgentBar onStop={onStop} />);
      expect(screen.queryByRole('button', { name: /^stop$/i })).toBeNull();
    });

    /* Stop ends the turn. It does not withdraw what the learner queued behind
       it — that is a separate, deliberate act with its own control. */
    it('says that stopping leaves what is waiting alone', () => {
      render(<AgentBar working messages={[said({ status: 'queued' })]} />);

      expect(screen.getByRole('button', { name: /^stop$/i })).toHaveAttribute(
        'title',
        expect.stringMatching(/waiting/i),
      );
    });
  });

  describe('the working state', () => {
    /* The state is a mark on the thing that has it, beside the word that names
       it, drifting until the answer lands — never a surface. */
    it('wears an unresolved mark beside the word while the agent works', async () => {
      const user = userEvent.setup();
      const { container } = render(<AgentBar working />);

      await user.click(screen.getByLabelText(FIELD));

      const mark = container.querySelector('.grain-mark');
      expect(mark.className).toMatch(/field-unresolved/);
      expect(mark.className).toMatch(/grain-working/);
      expect(screen.getByTestId('agent-state')).toHaveTextContent(/working/i);
    });

    it('settles the mark when the answer lands', async () => {
      const user = userEvent.setup();
      const { container } = render(<AgentBar messages={[said({ role: 'assistant' })]} />);

      await user.click(screen.getByLabelText(FIELD));

      const mark = container.querySelector('.grain-mark');
      expect(mark.className).toMatch(/field-settled/);
      expect(mark.className).not.toMatch(/grain-working/);
    });

    it('paints no surface anywhere, at any state', () => {
      const { container } = render(<AgentBar working />);

      expect(container.innerHTML).not.toMatch(/grain-field|grain-wash/);
    });

    /* A run in flight is something to watch, so the panel lifts itself: a bar
       answering behind a closed line would report nothing to anyone. This is
       what a reload during a run resumes into. */
    it('lifts itself while a run is in flight, without being asked', () => {
      render(<AgentBar working messages={[said({ role: 'assistant', content: 'A set' })]} />);

      expect(screen.getByText('A set')).toBeInTheDocument();
    });

    /* The bar used to announce `data-agent-working` so the frame could hold a
       page's own field down. Since v0.13.0 a field is a mark, no page paints
       one, and nothing ever read the attribute — so the bar says nothing. */
    it('announces no working state to the page, because nothing reads one', () => {
      const { container } = render(<AgentBar working />);

      expect(container.querySelector('[data-agent-working]')).toBeNull();
    });
  });

  describe('conversations and standing orders', () => {
    it('reaches the history from the edge of the panel', async () => {
      const user = userEvent.setup();
      render(<AgentBar threads={[{ id: 't1', title: 'Measure theory' }]} />);

      await user.click(screen.getByLabelText(FIELD));
      expect(screen.queryByRole('button', { name: /measure theory/i })).toBeNull();

      await user.click(screen.getByRole('button', { name: /conversations/i }));

      expect(screen.getByRole('button', { name: /measure theory/i })).toBeInTheDocument();
    });

    it('asks for the history the moment it is opened', async () => {
      const user = userEvent.setup();
      const onLoadThreads = vi.fn();
      render(<AgentBar onLoadThreads={onLoadThreads} />);

      await user.click(screen.getByLabelText(FIELD));
      await user.click(screen.getByRole('button', { name: /conversations/i }));

      expect(onLoadThreads).toHaveBeenCalled();
    });

    it('reaches the standing orders from the same edge', async () => {
      const user = userEvent.setup();
      render(
        <AgentBar
          orders={[{ id: 'o1', instruction: 'Plan my week', schedule: 'weekly', enabled: true }]}
        />,
      );

      await user.click(screen.getByLabelText(FIELD));
      await user.click(screen.getByRole('button', { name: /standing orders/i }));

      expect(screen.getByText(/plan my week/i)).toBeInTheDocument();
    });

    it('comes back to the conversation from either of them', async () => {
      const user = userEvent.setup();
      render(<AgentBar />);

      await user.click(screen.getByLabelText(FIELD));
      await user.click(screen.getByRole('button', { name: /standing orders/i }));
      await user.click(screen.getByRole('button', { name: /back to the conversation/i }));

      expect(screen.getByText(/answers come from your material/i)).toBeInTheDocument();
    });
  });

  describe('what it says when something breaks', () => {
    it('rules the message and paints nothing', () => {
      render(<AgentBar error="The agent could not be reached." />);

      const message = screen.getByRole('status');
      expect(message).toHaveTextContent(/could not be reached/i);
      expect(message.className).toMatch(/border-l-2/);
      expect(message.className).toMatch(/border-l-ink/);
      expect(message.className).not.toMatch(/red|green|amber/);
    });
  });

  it('closes on Escape without losing what was typed', async () => {
    const user = userEvent.setup();
    render(<AgentBar />);

    const field = screen.getByLabelText(FIELD);
    await user.type(field, 'half a thought');
    await user.keyboard('{Escape}');

    expect(screen.queryByText(/answers come from your material/i)).toBeNull();
    expect(field).toHaveValue('half a thought');
  });

  it('sends nothing when nothing was typed', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<AgentBar onSend={onSend} />);

    await user.click(screen.getByRole('button', { name: /^send$/i }));

    expect(onSend).not.toHaveBeenCalled();
  });

  it('empties the field once the message is on its way', async () => {
    const user = userEvent.setup();
    render(<AgentBar onSend={vi.fn().mockResolvedValue({})} />);

    const field = screen.getByLabelText(FIELD);
    await user.type(field, 'what is a ring?{Enter}');

    expect(field).toHaveValue('');
  });

  it('never says artefact', () => {
    const { container } = render(<AgentBar messages={[said()]} />);

    expect(container.textContent).not.toMatch(/artefact/i);
  });
});
