import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import DayBars from './day-bars';

const WEEK = [
  { date: '2026-07-19', value: 0 },
  { date: '2026-07-20', value: 4 },
  { date: '2026-07-21', value: 2 },
];

describe('day bars', () => {
  it('draws one bar per day', () => {
    render(<DayBars label="Reviews" days={WEEK} unit="review" />);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('says the count in words, so the height is not the only carrier', () => {
    render(<DayBars label="Reviews" days={WEEK} unit="review" />);

    expect(screen.getByText('20 July: 4 reviews')).toBeInTheDocument();
    expect(screen.getByText('19 July: no reviews')).toBeInTheDocument();
    expect(screen.getByText('21 July: 2 reviews')).toBeInTheDocument();
  });

  it('scales the tallest bar to the full height and the rest against it', () => {
    render(<DayBars label="Reviews" days={WEEK} unit="review" />);

    const bars = screen.getAllByTestId('day-bar');

    expect(bars[1]).toHaveStyle({ height: '100%' });
    expect(bars[2]).toHaveStyle({ height: '50%' });
  });

  it('never shows a percentage or a streak', () => {
    const { container } = render(<DayBars label="Reviews" days={WEEK} unit="review" />);

    expect(container.textContent).not.toMatch(/%|streak/i);
  });

  it('carries no bar at all when there is nothing to plot', () => {
    render(<DayBars label="Reviews" days={[]} unit="review" />);

    expect(screen.queryAllByTestId('day-bar')).toHaveLength(0);
  });

  it('formats a value when it is asked to', () => {
    render(
      <DayBars
        label="Cost"
        days={[{ date: '2026-07-20', value: 1.5 }]}
        unit="dollar"
        format={(value) => `$${value.toFixed(2)}`}
      />,
    );

    expect(screen.getByText('20 July: $1.50')).toBeInTheDocument();
  });
});
