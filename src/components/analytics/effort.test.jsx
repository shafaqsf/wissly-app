import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Effort from './effort';

const DAYS = [
  { date: '2026-07-24', calls: 2, cost: 1, byCause: { user: 0.75, schedule: 0.25 } },
  { date: '2026-07-25', calls: 3, cost: 0.5, byCause: { user: 0.1, schedule: 0.4 } },
];

describe('effort', () => {
  it('says what the week cost and how many calls it took', () => {
    render(<Effort days={DAYS} />);

    expect(screen.getByText('$1.50')).toBeInTheDocument();
    expect(screen.getByText('5 model calls over seven days')).toBeInTheDocument();
  });

  it('splits the cost by who asked for it', () => {
    render(<Effort days={DAYS} />);

    expect(screen.getByText('You asked for')).toBeInTheDocument();
    expect(screen.getByText('$0.85')).toBeInTheDocument();
    expect(screen.getByText('The agent decided')).toBeInTheDocument();
    expect(screen.getByText('$0.65')).toBeInTheDocument();
  });

  it('plots the cost of each day', () => {
    render(<Effort days={DAYS} />);

    expect(screen.getByRole('list', { name: 'Cost per day' })).toBeInTheDocument();
  });

  it('says nothing has been spent when nothing has', () => {
    render(<Effort days={[{ date: '2026-07-25', calls: 0, cost: 0, byCause: { user: 0, schedule: 0 } }]} />);

    expect(screen.getByText('Nothing spent yet.')).toBeInTheDocument();
  });
});
