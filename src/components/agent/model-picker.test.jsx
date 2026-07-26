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

  /* The free field is gone on purpose. The three are the offer, and a text box
     taking any of OpenRouter's hundreds made the choice look larger than the
     one the product actually supports — nothing here has been tried against a
     model outside the three. `OPENROUTER_MODEL` still decides the default, so
     the escape hatch exists; it is configuration, not a control. */
  it('offers no way to type an id of its own', () => {
    render(<ModelPicker model="" />);

    const options = [...screen.getByLabelText(/which model answers/i).options];

    expect(options.map((option) => option.value)).not.toContain('other');
    expect(screen.queryByLabelText(/model id/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /use this model/i })).toBeNull();
  });

  /* A default set outside the three is still the model in force, so it has to
     be readable in the dropdown rather than silently read as something else. */
  it('keeps an uncurated id visible once it is in force', () => {
    render(<ModelPicker model="mistralai/mistral-large" />);

    expect(screen.getByLabelText(/which model answers/i)).toHaveValue('mistralai/mistral-large');
  });
});
