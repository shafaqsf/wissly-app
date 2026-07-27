import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ModePicker from './mode-picker';

describe('the mode picker', () => {
  it('is one dropdown rather than a row of toggles', () => {
    render(<ModePicker mode="chat" />);

    const picker = screen.getByLabelText(/what the agent may do/i);
    expect(picker.tagName).toBe('SELECT');
    expect([...picker.options].map((option) => option.value)).toEqual([
      'chat',
      'socratic',
      'agent',
    ]);
  });

  it('shows the mode this message will be sent in', () => {
    render(<ModePicker mode="agent" />);

    expect(screen.getByLabelText(/what the agent may do/i)).toHaveValue('agent');
  });

  /* The consequence used to ride inside the option text, which made the
     closed control forty characters wide and pushed the model picker onto a
     line of its own. It reads as a line under the pair instead: still on the
     screen, still ink, and no longer deciding the layout. */
  it('keeps the option itself short enough to sit beside the model picker', () => {
    render(<ModePicker mode="chat" />);

    expect(screen.getByRole('option', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Socratic' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Agent' })).toBeInTheDocument();
  });

  it('says what the mode in force will do, under the control', () => {
    const { rerender } = render(<ModePicker mode="chat" />);

    expect(screen.getByText(/changes nothing/i)).toBeInTheDocument();

    rerender(<ModePicker mode="socratic" />);

    expect(screen.getByText(/question/i)).toBeInTheDocument();

    rerender(<ModePicker mode="agent" />);

    expect(screen.getByText(/undone/i)).toBeInTheDocument();
  });

  it('tells the learner socratic mode changes nothing either, the same guarantee chat makes', () => {
    render(<ModePicker mode="socratic" />);

    expect(screen.getByText(/changes nothing/i)).toBeInTheDocument();
  });

  it('reports the mode the learner picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModePicker mode="chat" onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/what the agent may do/i), 'agent');

    expect(onChange).toHaveBeenCalledWith('agent');
  });

  it('names no artefact anywhere the learner can read', () => {
    const { container } = render(<ModePicker mode="agent" />);

    expect(container.textContent).not.toMatch(/artefact/i);
  });
});
