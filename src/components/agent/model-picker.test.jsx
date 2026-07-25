import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CURATED_MODELS } from '@/lib/agent/models.js';

import ModelPicker from './model-picker';

describe('the model picker', () => {
  it('is a dropdown of its own, beside the mode and independent of it', () => {
    render(<ModelPicker model="anthropic/claude-sonnet-5" />);

    const picker = screen.getByLabelText(/which model answers/i);
    expect(picker.tagName).toBe('SELECT');
    expect(picker).toHaveValue('anthropic/claude-sonnet-5');
  });

  it('offers the three curated models by name', () => {
    render(<ModelPicker model="" />);

    for (const { name } of CURATED_MODELS) {
      expect(screen.getByRole('option', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
  });

  /* Cost is made visible so the learner can decide, which is a different thing
     from being decided for: there is no spending cap in wissly. */
  it('shows the price beside each curated name', () => {
    render(<ModelPicker model="" />);

    expect(screen.getByRole('option', { name: /Claude Sonnet 5/i })).toHaveTextContent(
      /\$2\.00 in · \$10\.00 out/,
    );
    expect(screen.getByRole('option', { name: /DeepSeek V4 Pro/i })).toHaveTextContent(
      /\$0\.44 in · \$0\.87 out/,
    );
  });

  it('reports the model the learner picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModelPicker model="" onChange={onChange} />);

    await user.selectOptions(
      screen.getByLabelText(/which model answers/i),
      'deepseek/deepseek-v4-pro',
    );

    expect(onChange).toHaveBeenCalledWith('deepseek/deepseek-v4-pro');
  });

  /* A curated list of three goes stale and the catalogue has hundreds. */
  it('takes any OpenRouter model id from a field of its own', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModelPicker model="" onChange={onChange} />);

    expect(screen.queryByLabelText(/model id/i)).toBeNull();

    await user.selectOptions(screen.getByLabelText(/which model answers/i), 'other');
    await user.type(screen.getByLabelText(/model id/i), 'mistralai/mistral-large');
    await user.click(screen.getByRole('button', { name: /use this model/i }));

    expect(onChange).toHaveBeenCalledWith('mistralai/mistral-large');
  });

  it('says what an id looks like rather than sending one that cannot work', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModelPicker model="" onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/which model answers/i), 'other');
    await user.type(screen.getByLabelText(/model id/i), 'not an id');
    await user.click(screen.getByRole('button', { name: /use this model/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/vendor\/model/i);
  });

  /* Status is carried by words and by the one 2px ink rule nothing else has —
     never by a colour. See "No status colours" in docs/DESIGN.md. */
  it('rules its own paragraph when it refuses an id, and paints nothing', async () => {
    const user = userEvent.setup();
    render(<ModelPicker model="" />);

    await user.selectOptions(screen.getByLabelText(/which model answers/i), 'other');
    await user.type(screen.getByLabelText(/model id/i), 'nope');
    await user.click(screen.getByRole('button', { name: /use this model/i }));

    const message = screen.getByRole('status');
    expect(message.className).toMatch(/border-l-2/);
    expect(message.className).toMatch(/border-l-ink/);
    expect(message.className).not.toMatch(/red|green|bg-/);
  });

  /* A model chosen from the free field is still the model in force, so it has
     to be readable in the dropdown rather than vanish behind "Other". */
  it('keeps an uncurated id visible once it is in force', () => {
    render(<ModelPicker model="mistralai/mistral-large" />);

    expect(screen.getByLabelText(/which model answers/i)).toHaveValue('mistralai/mistral-large');
  });
});
