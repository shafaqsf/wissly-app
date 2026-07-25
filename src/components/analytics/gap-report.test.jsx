import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import GapReport from './gap-report';

const GAPS = [
  {
    id: 'c1',
    subjectId: 's1',
    name: 'Cauchy sequence',
    mastery: 0.2,
    sectionOrdinal: 3,
    source: { id: 'src-1', title: 'Rudin, chapter 3' },
  },
  {
    id: 'c2',
    subjectId: 's1',
    name: 'Compactness',
    mastery: 0.5,
    sectionOrdinal: null,
    source: null,
  },
];

describe('the gap report', () => {
  it('names what does not hold yet', () => {
    render(<GapReport gaps={GAPS} />);

    expect(screen.getByText('Cauchy sequence')).toBeInTheDocument();
    expect(screen.getByText('Compactness')).toBeInTheDocument();
  });

  it('links a gap to the material it came from', () => {
    render(<GapReport gaps={GAPS} />);

    expect(screen.getByRole('link', { name: /Rudin, chapter 3/ })).toHaveAttribute(
      'href',
      '/courses/s1?source=src-1',
    );
  });

  it('says so plainly when a gap has lost its source', () => {
    render(<GapReport gaps={GAPS} />);

    expect(screen.getByText('Source no longer on the shelf')).toBeInTheDocument();
  });

  it('offers the next step when nothing has failed yet', () => {
    render(<GapReport gaps={[]} />);

    expect(
      screen.getByRole('link', { name: 'Start a round' }),
    ).toHaveAttribute('href', '/tasks/due');
  });

  it('shows no percentage — a gap is a name, not a score', () => {
    const { container } = render(<GapReport gaps={GAPS} />);

    expect(container.textContent).not.toMatch(/%/);
  });
});
