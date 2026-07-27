import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Transcript from './transcript';

const said = (over = {}) => ({
  id: 'm1',
  role: 'user',
  content: 'What is a σ-algebra?',
  status: 'done',
  mode: 'chat',
  model: 'anthropic/claude-sonnet-5',
  ...over,
});

describe('the transcript', () => {
  it('invites the learner to act rather than apologising for being empty', () => {
    render(<Transcript messages={[]} />);

    expect(screen.getByText(/ask about anything you have added/i)).toBeInTheDocument();
  });

  /* Mode is recorded per message, so switching mid-thread is normal and the
     transcript has to say who acted on every line. */
  it('says who acted and which model answered, on every line', () => {
    render(
      <Transcript
        messages={[
          said(),
          said({ id: 'm2', role: 'assistant', content: 'A collection of sets.', mode: 'agent', model: 'deepseek/deepseek-v4-pro' }),
        ]}
      />,
    );

    expect(screen.getByTestId('meta-m1')).toHaveTextContent(/You/);
    expect(screen.getByTestId('meta-m1')).toHaveTextContent(/Chat/);
    expect(screen.getByTestId('meta-m1')).toHaveTextContent(/Claude Sonnet 5/);
    expect(screen.getByTestId('meta-m2')).toHaveTextContent(/wissly/);
    expect(screen.getByTestId('meta-m2')).toHaveTextContent(/Agent/);
    expect(screen.getByTestId('meta-m2')).toHaveTextContent(/DeepSeek V4 Pro/);
  });

  it('names an uncurated model by its id rather than saying nothing', () => {
    render(<Transcript messages={[said({ model: 'mistralai/mistral-large' })]} />);

    expect(screen.getByTestId('meta-m1')).toHaveTextContent(/mistralai\/mistral-large/);
  });

  /* An answer built on passages the agent read carries an anchor back to them.
     That is the promise the interface renders. */
  it('shows where an answer came from', () => {
    render(
      <Transcript
        messages={[
          said({
            role: 'assistant',
            content: 'A collection of sets.',
            anchors: [{ section_id: 'sec-1' }, { section_id: 'sec-2' }],
          }),
        ]}
      />,
    );

    const anchors = screen.getByTestId('anchors-m1');
    expect(anchors).toHaveTextContent(/from your material/i);
    expect(within(anchors).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows no anchor row on an answer that read nothing', () => {
    render(<Transcript messages={[said({ role: 'assistant', anchors: [] })]} />);

    expect(screen.queryByTestId('anchors-m1')).toBeNull();
  });

  /* The queue, visibly: the field is never taken away, so a message sent while
     a run is in flight is on the screen before the previous answer finishes. */
  it('says a queued message is waiting, in words', () => {
    render(<Transcript messages={[said({ status: 'queued' })]} />);

    expect(screen.getByTestId('meta-m1')).toHaveTextContent(/waiting/i);
  });

  it('lets a waiting message be withdrawn before it starts', async () => {
    const user = userEvent.setup();
    const onWithdraw = vi.fn();
    render(<Transcript messages={[said({ status: 'queued' })]} onWithdraw={onWithdraw} />);

    await user.click(screen.getByRole('button', { name: /withdraw/i }));

    expect(onWithdraw).toHaveBeenCalledWith('m1');
  });

  it('offers no withdraw on a message that has already started', () => {
    render(<Transcript messages={[said({ status: 'running' })]} onWithdraw={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /withdraw/i })).toBeNull();
  });

  /* The deltas land in the row as they arrive; a half-written answer is read
     as a half-written answer rather than as an empty panel. */
  it('renders a partial answer while it is still being written', () => {
    render(<Transcript messages={[said({ role: 'assistant', status: 'running', content: 'A collect' })]} />);

    expect(screen.getByText('A collect')).toBeInTheDocument();
  });

  it('says the agent is working when the answer has not begun', () => {
    render(<Transcript messages={[said({ role: 'assistant', status: 'running', content: '' })]} />);

    expect(screen.getByText(/reading your material/i)).toBeInTheDocument();
  });

  /* Status carries no hue. A failed turn gets the one 2px ink rule in the
     product; there are no status colours. */
  it('rules a failed turn rather than colouring it', () => {
    render(<Transcript messages={[said({ role: 'assistant', status: 'failed', content: 'Ran out of tokens.' })]} />);

    const turn = screen.getByTestId('turn-m1');
    expect(turn.className).toMatch(/border-l-2/);
    expect(turn.className).toMatch(/border-l-ink/);
    expect(turn.className).not.toMatch(/red|green|amber/);
  });

  /* With thirty writes in a run, a run that dies halfway must report what
     completed, or Undo is guesswork. */
  it('names what got through when a run dies halfway', () => {
    render(
      <Transcript
        messages={[said({ role: 'assistant', status: 'failed', content: 'Ran out of tokens.' })]}
        runs={{ m1: { runId: 'r1', completed: ['a course "Measure theory"', '8 cards'], outstanding: 2 } }}
      />,
    );

    const turn = screen.getByTestId('turn-m1');
    expect(turn).toHaveTextContent(/before it stopped/i);
    expect(turn).toHaveTextContent(/a course "Measure theory"/);
    expect(turn).toHaveTextContent(/8 cards/);
  });

  it('says a half-finished run changed nothing when nothing landed', () => {
    render(
      <Transcript
        messages={[said({ role: 'assistant', status: 'failed', content: 'Ran out.' })]}
        runs={{ m1: { runId: 'r1', completed: [], outstanding: 0 } }}
      />,
    );

    expect(screen.getByTestId('turn-m1')).toHaveTextContent(/nothing was changed/i);
  });

  /* Undo sits on the message that caused the writes, so the learner does not
     have to know what a run is to reach it. */
  it('offers undo on the message whose run changed something', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(
      <Transcript
        messages={[said({ role: 'assistant', content: 'Made you eight cards.' })]}
        runs={{ m1: { runId: 'r1', completed: [], outstanding: 8 } }}
        onUndo={onUndo}
      />,
    );

    expect(screen.getByTestId('turn-m1')).toHaveTextContent(/8 changes/);

    await user.click(screen.getByRole('button', { name: /take these changes back/i }));

    expect(onUndo).toHaveBeenCalledWith('r1');
  });

  /* A run whose count is not known is still a run that may have changed
     something. Saying so without a number beats saying nothing: the way back
     has to be as reachable as the way forward. */
  it('offers undo without a count when the count is not known', () => {
    render(
      <Transcript
        messages={[said({ role: 'assistant', content: 'Made you eight cards.' })]}
        runs={{ m1: { runId: null, completed: [], outstanding: null } }}
        onUndo={vi.fn()}
      />,
    );

    const turn = screen.getByTestId('turn-m1');
    expect(turn).toHaveTextContent(/can be taken back/i);
    expect(turn).not.toHaveTextContent(/null/);
    expect(screen.getByRole('button', { name: /take these changes back/i })).toBeInTheDocument();
  });

  it('offers no undo on a run that only read', () => {
    render(
      <Transcript
        messages={[said({ role: 'assistant', content: 'A collection of sets.' })]}
        runs={{ m1: { runId: 'r1', completed: [], outstanding: 0 } }}
        onUndo={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /take these changes back/i })).toBeNull();
  });

  it('offers no undo twice on a run already taken back', () => {
    render(
      <Transcript
        messages={[said({ role: 'assistant' })]}
        runs={{ m1: { runId: 'r1', completed: [], outstanding: 0, undone: true } }}
        onUndo={vi.fn()}
      />,
    );

    expect(screen.getByTestId('turn-m1')).toHaveTextContent(/taken back/i);
  });

  /* "I made you eight cards" is worse than landing on them — but a silent page
     change is disorienting, so the transcript says where it went. */
  it('says where the agent took the learner', () => {
    render(
      <Transcript
        messages={[said({ role: 'assistant', content: 'Made you eight cards.' })]}
        intents={{ m1: [{ kind: 'navigate', path: '/courses/x', query: {}, label: 'the course' }] }}
      />,
    );

    expect(screen.getByTestId('turn-m1')).toHaveTextContent(/opened the course/i);
  });

  it('never says artefact', () => {
    const { container } = render(
      <Transcript
        messages={[said({ role: 'assistant', status: 'failed' })]}
        runs={{ m1: { runId: 'r1', completed: ['8 cards'], outstanding: 8 } }}
      />,
    );

    expect(container.textContent).not.toMatch(/artefact/i);
  });

  /* A list arrives in order. The class is switched off wholesale under
     prefers-reduced-motion, which is what makes it cheap to honour. */
  it('staggers the turns as they arrive', () => {
    render(<Transcript messages={[said()]} />);

    expect(screen.getByRole('list').className).toMatch(/motion-stagger/);
  });
});
