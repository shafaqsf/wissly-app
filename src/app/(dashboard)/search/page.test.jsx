import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { search } = vi.hoisted(() => ({ search: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock('@/lib/data/search', async () => {
  const actual = await vi.importActual('@/lib/data/search.js');
  return { ...actual, search };
});

import SearchPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  search.mockResolvedValue([]);
});

function params(searchParams = {}) {
  return { searchParams: Promise.resolve(searchParams) };
}

describe('the search page', () => {
  it('asks the database, never a model', async () => {
    render(await SearchPage(params({ q: 'cauchy' })));

    expect(search).toHaveBeenCalledWith({}, { query: 'cauchy', subjectId: undefined });
  });

  it('scopes the search to a course when the url says so', async () => {
    render(await SearchPage(params({ q: 'cauchy', course: 's1' })));

    expect(search).toHaveBeenCalledWith({}, { query: 'cauchy', subjectId: 's1' });
  });

  it('does not search at all before anything is typed', async () => {
    render(await SearchPage(params({})));

    expect(search).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('leads a hit to where the thing lives', async () => {
    search.mockResolvedValue([
      {
        kind: 'concept',
        id: 'c1',
        subjectId: 's1',
        parentId: null,
        title: 'Cauchy sequence',
        snippet: '',
        createdAt: '2026-07-20T00:00:00.000Z',
      },
    ]);

    render(await SearchPage(params({ q: 'cauchy' })));

    expect(screen.getByRole('link', { name: /Cauchy sequence/ })).toHaveAttribute(
      'href',
      '/analytics?concept=c1',
    );
  });

  it('says what went wrong rather than falling over', async () => {
    search.mockRejectedValue(new Error('Could not search your material.'));

    render(await SearchPage(params({ q: 'cauchy' })));

    expect(screen.getByRole('alert')).toHaveTextContent('Could not search your material.');
  });
});
