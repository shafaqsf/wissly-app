import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import VoiceToggle from './voice-toggle';

describe('VoiceToggle', () => {
  it('renders nothing on a browser with neither half of the API — the fallback path', () => {
    const { container } = render(<VoiceToggle support={{ input: false, output: false }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('still offers voice mode when only speaking replies aloud is supported', () => {
    render(<VoiceToggle support={{ input: false, output: true }} />);
    expect(screen.getByRole('button', { name: /turn voice mode on/i })).toBeInTheDocument();
  });

  it('still offers voice mode when only dictation is supported', () => {
    render(<VoiceToggle support={{ input: true, output: false }} />);
    expect(screen.getByRole('button', { name: /turn voice mode on/i })).toBeInTheDocument();
  });

  it('reports the toggle the learner pressed', async () => {
    const user = userEvent.setup();
    const onToggleVoice = vi.fn();
    render(<VoiceToggle support={{ input: true, output: true }} onToggleVoice={onToggleVoice} />);

    await user.click(screen.getByRole('button', { name: /turn voice mode on/i }));
    expect(onToggleVoice).toHaveBeenCalledWith(true);
  });

  it('shows voice mode is on', () => {
    render(<VoiceToggle support={{ input: true, output: true }} voiceOn />);
    expect(screen.getByRole('button', { name: /turn voice mode off/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('holds no mic control until voice mode is actually on', () => {
    render(<VoiceToggle support={{ input: true, output: true }} voiceOn={false} />);
    expect(screen.queryByRole('button', { name: /speak your question/i })).not.toBeInTheDocument();
  });

  it('offers the mic once voice mode is on, if the browser can listen', () => {
    render(<VoiceToggle support={{ input: true, output: true }} voiceOn />);
    expect(screen.getByRole('button', { name: /speak your question/i })).toBeInTheDocument();
  });

  it('never offers a mic on a browser that cannot listen, even with voice mode on', () => {
    render(<VoiceToggle support={{ input: false, output: true }} voiceOn />);
    expect(screen.queryByRole('button', { name: /speak your question/i })).not.toBeInTheDocument();
  });

  it('reports when the learner starts and stops listening', async () => {
    const user = userEvent.setup();
    const onToggleListening = vi.fn();
    render(
      <VoiceToggle
        support={{ input: true, output: true }}
        voiceOn
        listening={false}
        onToggleListening={onToggleListening}
      />,
    );

    await user.click(screen.getByRole('button', { name: /speak your question/i }));
    expect(onToggleListening).toHaveBeenCalledWith(true);
  });

  it('names the mic button by what pressing it again will do, while listening', () => {
    render(<VoiceToggle support={{ input: true, output: true }} voiceOn listening />);
    expect(screen.getByRole('button', { name: /stop listening/i })).toBeInTheDocument();
  });

  it('every icon-only control carries an aria-label, per the icon rule', () => {
    render(<VoiceToggle support={{ input: true, output: true }} voiceOn />);
    const mic = screen.getByRole('button', { name: /speak your question/i });
    expect(mic).toHaveAttribute('aria-label');
  });
});
