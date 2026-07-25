import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SearchField from './search-field';

describe('the search field', () => {
  it('has a real label, not a placeholder standing in for one', () => {
    render(<SearchField />);

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('submits to the search page with a plain GET, so it costs nothing', () => {
    render(<SearchField />);

    const form = screen.getByRole('search');

    expect(form).toHaveAttribute('action', '/search');
    expect(form).toHaveAttribute('method', 'get');
    expect(screen.getByLabelText('Search')).toHaveAttribute('name', 'q');
  });

  it('keeps what was already searched for', () => {
    render(<SearchField query="cauchy" />);

    expect(screen.getByLabelText('Search')).toHaveValue('cauchy');
  });

  it('carries the course through when the page is scoped to one', () => {
    render(<SearchField query="cauchy" subjectId="s1" />);

    expect(screen.getByDisplayValue('s1')).toHaveAttribute('name', 'course');
  });
});
