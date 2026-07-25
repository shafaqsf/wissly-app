import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import StandingOrderList from './standing-order-list';

const order = (over = {}) => ({
  id: 'o1',
  instruction: 'Notice concepts I am behind on and make me more cards',
  schedule: 'weekly',
  enabled: true,
  last_run_at: null,
  ...over,
});

describe('the standing orders', () => {
  /* This is the agent acting with nobody present, so the surface has to say
     that plainly before anything is created. */
  it('says what a standing order is, in words, before there is one', () => {
    render(<StandingOrderList orders={[]} />);

    expect(screen.getByText(/without you being here/i)).toBeInTheDocument();
  });

  it('lists each order with its instruction and its schedule', () => {
    render(<StandingOrderList orders={[order()]} />);

    expect(screen.getByText(/notice concepts i am behind on/i)).toBeInTheDocument();
    expect(screen.getByTestId('order-o1')).toHaveTextContent(/weekly/i);
  });

  it('says when an order last ran, and says so when it never has', () => {
    render(<StandingOrderList orders={[order(), order({ id: 'o2', last_run_at: '2026-07-24T09:00:00Z' })]} />);

    expect(screen.getByTestId('order-o1')).toHaveTextContent(/has not run yet/i);
    expect(screen.getByTestId('order-o2')).toHaveTextContent(/last ran/i);
  });

  it('creates an order from an instruction and a schedule', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({});
    render(<StandingOrderList orders={[]} onCreate={onCreate} />);

    await user.type(screen.getByLabelText(/what should the agent do/i), 'Plan my week');
    await user.type(screen.getByLabelText(/how often/i), 'weekly');
    await user.click(screen.getByRole('button', { name: /add standing order/i }));

    expect(onCreate).toHaveBeenCalledWith({ instruction: 'Plan my week', schedule: 'weekly' });
  });

  it('says what a schedule may look like rather than sending one nothing can read', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<StandingOrderList orders={[]} onCreate={onCreate} />);

    await user.type(screen.getByLabelText(/what should the agent do/i), 'Plan my week');
    await user.click(screen.getByRole('button', { name: /add standing order/i }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/daily, weekly, monthly/i);
  });

  it('reports what the server refused, ruled and unpainted', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ error: 'That is not a schedule.' });
    render(<StandingOrderList orders={[]} onCreate={onCreate} />);

    await user.type(screen.getByLabelText(/what should the agent do/i), 'Plan my week');
    await user.type(screen.getByLabelText(/how often/i), 'sometimes');
    await user.click(screen.getByRole('button', { name: /add standing order/i }));

    const message = await screen.findByRole('status');
    expect(message).toHaveTextContent(/that is not a schedule/i);
    expect(message.className).toMatch(/border-l-2/);
    expect(message.className).not.toMatch(/red|green/);
  });

  /* Enabled is a switch rather than an archive, because a paused order is a
     thing the learner means to start again. */
  it('turns an order off and on', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(<StandingOrderList orders={[order()]} onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: /turn off/i }));
    expect(onToggle).toHaveBeenCalledWith('o1', false);

    rerender(<StandingOrderList orders={[order({ enabled: false })]} onToggle={onToggle} />);
    expect(screen.getByTestId('order-o1')).toHaveTextContent(/paused/i);

    await user.click(screen.getByRole('button', { name: /turn on/i }));
    expect(onToggle).toHaveBeenCalledWith('o1', true);
  });

  it('edits an order in place', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue({});
    render(<StandingOrderList orders={[order()]} onUpdate={onUpdate} />);

    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    const instruction = screen.getByLabelText(/what should the agent do/i);
    await user.clear(instruction);
    await user.type(instruction, 'Archive duplicates');
    await user.click(screen.getByRole('button', { name: /save order/i }));

    expect(onUpdate).toHaveBeenCalledWith({
      id: 'o1',
      instruction: 'Archive duplicates',
      schedule: 'weekly',
    });
  });

  it('deletes an order, once it has been asked about', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<StandingOrderList orders={[order()]} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /delete for good/i }));
    expect(onDelete).toHaveBeenCalledWith('o1');
  });

  it('never says artefact', () => {
    const { container } = render(<StandingOrderList orders={[order()]} />);

    expect(container.textContent).not.toMatch(/artefact/i);
  });
});
