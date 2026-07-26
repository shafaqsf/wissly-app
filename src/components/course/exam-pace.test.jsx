import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ExamPace from './exam-pace';

const noop = () => ({});

describe('with no exam date set', () => {
  const goal = { target: 3, remaining: 3, horizonDays: 7 };

  it('offers a field to set one', () => {
    render(<ExamPace courseId="c1" action={noop} examDate={null} goal={goal} plan={null} />);

    expect(screen.getByLabelText('Exam date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set date' })).toBeInTheDocument();
  });

  it('still names the daily pace against what is due', () => {
    render(<ExamPace courseId="c1" action={noop} examDate={null} goal={goal} plan={null} />);

    expect(screen.getByText(/3 more today to keep pace with what is due\./)).toBeInTheDocument();
  });

  it('carries the course id through the form', () => {
    const { container } = render(
      <ExamPace courseId="course-9" action={noop} examDate={null} goal={goal} plan={null} />,
    );

    expect(container.querySelector('input[name="courseId"]')).toHaveValue('course-9');
  });
});

describe('with an exam date set', () => {
  const goal = { target: 5, remaining: 2, horizonDays: 4 };
  const plan = {
    days: [
      { date: '2026-07-26', count: 2 },
      { date: '2026-07-27', count: 3 },
    ],
  };

  it('says how many more reviews to stay on track, naming the exam date', () => {
    render(
      <ExamPace courseId="c1" action={noop} examDate="2026-07-30" goal={goal} plan={plan} />,
    );

    expect(
      screen.getByText(/2 more today to stay on track for the exam on 30 July\./),
    ).toBeInTheDocument();
  });

  it('renders the day-by-day plan', () => {
    render(
      <ExamPace courseId="c1" action={noop} examDate="2026-07-30" goal={goal} plan={plan} />,
    );

    expect(screen.getByText('2 reviews')).toBeInTheDocument();
    expect(screen.getByText('3 reviews')).toBeInTheDocument();
  });

  it('offers to update the date rather than set it again', () => {
    render(
      <ExamPace courseId="c1" action={noop} examDate="2026-07-30" goal={goal} plan={plan} />,
    );

    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
    expect(screen.getByLabelText('Exam date')).toHaveValue('2026-07-30');
  });

  it("says the target is met once today's reviews are done", () => {
    render(
      <ExamPace
        courseId="c1"
        action={noop}
        examDate="2026-07-30"
        goal={{ target: 5, remaining: 0, horizonDays: 4 }}
        plan={plan}
      />,
    );

    expect(screen.getByText(/Today's target is done\./)).toBeInTheDocument();
  });
});

describe('a failed save', () => {
  it('is announced and stated in words, with no colour', () => {
    render(
      <ExamPace
        courseId="c1"
        action={noop}
        examDate={null}
        goal={{ target: 0, remaining: 0, horizonDays: 7 }}
        plan={null}
        initialState={{ message: 'Could not set the exam date.' }}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not set the exam date.');
    expect(alert.className).toContain('border-l-2');
    expect(alert.className).toContain('border-l-ink');
  });
});
