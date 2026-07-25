import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ModePicker from './mode-picker';

describe('the mode picker', () => {
  it('is one dropdown rather than two toggles', () => {
    render(<ModePicker mode="chat" />);

    const picker = screen.getByLabelText(/what the agent may do/i);
    expect(picker.tagName).toBe('SELECT');
    expect([...picker.options].map((option) => option.value)).toEqual(['chat', 'agent']);
  });

  it('shows the mode this message will be sent in', () => {
    render(<ModePicker mode="agent" />);

    expect(screen.getByLabelText(/what the agent may do/i)).toHaveValue('agent');
  });

  /* The choice is about consequence, so the consequence is on the screen
     before the choice is made rather than in a tooltip after it. */
  it('says what each mode does in the options themselves', () => {
    render(<ModePicker mode="chat" />);

    expect(screen.getByRole('option', { name: /chat/i })).toHaveTextContent(/changes nothing/i);
    expect(screen.getByRole('option', { name: /agent/i })).toHaveTextContent(/undone/i);
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
