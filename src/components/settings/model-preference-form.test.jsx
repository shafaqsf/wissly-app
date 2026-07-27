import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CURATED_MODELS } from '@/lib/agent/models.js';

import ModelPreferenceForm from './model-preference-form';

describe('the model preference form', () => {
  it('shows the stored default, or the environment default when none is set', () => {
    render(<ModelPreferenceForm defaultModel="" action={vi.fn()} />);

    expect(screen.getByLabelText(/model for generation/i)).toHaveValue('');
    expect(screen.getByRole('option', { name: /environment default/i })).toBeInTheDocument();
  });

  it('offers the curated models, priced, and nothing else', () => {
    render(<ModelPreferenceForm defaultModel="" action={vi.fn()} />);

    for (const { name } of CURATED_MODELS) {
      expect(screen.getByRole('option', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
    expect(screen.queryByLabelText(/model id/i)).toBeNull();
  });

  it('saves the choice as soon as it is made', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ preferences: { default_model: 'deepseek/deepseek-v4-pro' } }));

    render(<ModelPreferenceForm defaultModel="" action={action} />);
    await user.selectOptions(
      screen.getByLabelText(/model for generation/i),
      'deepseek/deepseek-v4-pro',
    );

    await waitFor(() => {
      expect(action).toHaveBeenCalledWith({ model: 'deepseek/deepseek-v4-pro' });
    });
  });

  it('reports what the server refused, so a save that failed is not silent', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ error: 'That did not save. Try again.' }));

    render(<ModelPreferenceForm defaultModel="" action={action} />);
    await user.selectOptions(
      screen.getByLabelText(/model for generation/i),
      'anthropic/claude-sonnet-5',
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Try again.');
  });
});
