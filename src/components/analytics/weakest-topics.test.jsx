import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import WeakestTopics from './weakest-topics';

const CONCEPTS = [
  { id: 'c1', subjectId: 's1', name: 'Untouched idea', mastery: 0 },
  { id: 'c2', subjectId: 's1', name: 'Cauchy sequence', mastery: 0.2 },
];

describe('the weakest-topics panel', () => {
  it('ranks the concepts in the order it was given, worst first', () => {
    render(<WeakestTopics concepts={CONCEPTS} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Untouched idea');
    expect(items[1]).toHaveTextContent('Cauchy sequence');
  });

  it('shows a real percentage next to each name', () => {
    render(<WeakestTopics concepts={CONCEPTS} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('deep-links each topic into its own mastery panel', () => {
    render(<WeakestTopics concepts={CONCEPTS} />);

    expect(screen.getByRole('link', { name: /Cauchy sequence/ })).toHaveAttribute(
      'href',
      '/analytics?course=s1&concept=c2',
    );
  });

  it('says plainly when nothing is weak', () => {
    render(<WeakestTopics concepts={[]} />);

    expect(screen.getByText(/nothing below mastered/i)).toBeInTheDocument();
  });
});
