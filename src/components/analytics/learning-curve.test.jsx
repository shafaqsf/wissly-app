import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LearningCurve from './learning-curve';

const POINTS = [
  { date: '2026-07-01', reviews: 0, recall: null },
  { date: '2026-07-02', reviews: 3, recall: 0.4 },
  { date: '2026-07-03', reviews: 0, recall: null },
  { date: '2026-07-04', reviews: 5, recall: 0.8 },
];

describe('the learning curve', () => {
  it('draws a chart once there is more than one day of recall to compare', () => {
    render(<LearningCurve label="Cauchy sequence" points={POINTS} />);

    expect(screen.getByRole('img', { name: /Cauchy sequence/ })).toBeInTheDocument();
  });

  it('says the most recent recall rate in real numbers — this surface is exempt from the no-percentage rule', () => {
    render(<LearningCurve label="Cauchy sequence" points={POINTS} />);

    expect(screen.getByText(/80%/)).toBeInTheDocument();
  });

  it('invites more reviews instead of drawing an empty or single-point chart', () => {
    render(<LearningCurve label="Cauchy sequence" points={[{ date: '2026-07-01', reviews: 1, recall: 1 }]} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/not enough review history/i)).toBeInTheDocument();
  });

  it('handles no history at all without crashing', () => {
    render(<LearningCurve label="Cauchy sequence" points={[]} />);

    expect(screen.getByText(/not enough review history/i)).toBeInTheDocument();
  });
});
