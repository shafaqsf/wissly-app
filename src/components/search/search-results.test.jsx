import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SearchResults, { destinationFor, labelFor } from './search-results';

function hit(overrides = {}) {
  return {
    kind: 'source',
    id: 'src-1',
    subjectId: 's1',
    parentId: null,
    title: 'Rudin, chapter 3',
    snippet: 'A sequence converges if …',
    createdAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('where a hit leads', () => {
  it('sends a source to the shelf it sits on', () => {
    expect(destinationFor(hit())).toBe('/courses/s1?source=src-1');
  });

  it('sends a section to the source it was cut from', () => {
    expect(
      destinationFor(hit({ kind: 'section', id: 'sec-1', parentId: 'src-1' })),
    ).toBe('/courses/s1?source=src-1&section=sec-1');
  });

  it('sends a concept to its own reading on analytics', () => {
    expect(destinationFor(hit({ kind: 'concept', id: 'c1' }))).toBe(
      '/analytics?concept=c1',
    );
  });

  it('sends a task to the workbench, on the type it is', () => {
    expect(destinationFor(hit({ kind: 'artefact', id: 'a1', title: 'flashcard' }))).toBe(
      '/tasks/flashcards?task=a1',
    );
  });

  it('sends reading to the course it belongs to', () => {
    expect(destinationFor(hit({ kind: 'artefact', id: 'a1', title: 'summary' }))).toBe(
      '/courses/s1?reading=a1',
    );
  });

  it('sends a conversation to its thread', () => {
    expect(destinationFor(hit({ kind: 'conversation', id: 'conv-1' }))).toBe(
      '/dashboard?conversation=conv-1',
    );
  });
});

describe('what a hit is called', () => {
  it('never says "artefact"', () => {
    expect(labelFor(hit({ kind: 'artefact', title: 'flashcard' }))).toBe('Flashcard');
    expect(labelFor(hit({ kind: 'artefact', title: 'multiple_choice' }))).toBe(
      'Multiple choice',
    );
    expect(labelFor(hit({ kind: 'artefact', title: 'summary' }))).toBe('Summary');
  });

  it('names the other four the way a learner would', () => {
    expect(labelFor(hit({ kind: 'source' }))).toBe('Source');
    expect(labelFor(hit({ kind: 'section' }))).toBe('Section');
    expect(labelFor(hit({ kind: 'concept' }))).toBe('Concept');
    expect(labelFor(hit({ kind: 'conversation' }))).toBe('Conversation');
  });
});

describe('the results surface', () => {
  it('leads every hit to where the thing lives', () => {
    render(<SearchResults query="cauchy" results={[hit()]} />);

    expect(screen.getByRole('link', { name: /Rudin, chapter 3/ })).toHaveAttribute(
      'href',
      '/courses/s1?source=src-1',
    );
  });

  it('titles a task by its type rather than by its payload', () => {
    render(
      <SearchResults
        query="cauchy"
        results={[hit({ kind: 'artefact', id: 'a1', title: 'flashcard' })]}
      />,
    );

    expect(screen.getByRole('link', { name: /Flashcard/ })).toBeInTheDocument();
  });

  it('says the search found nothing, and what to try', () => {
    render(<SearchResults query="cauchy" results={[]} />);

    expect(screen.getByText(/Nothing matches “cauchy”/)).toBeInTheDocument();
  });

  /* task item 7 in v0.15: an empty search result carries a small
     illustration beside the sentence that already explains it. */
  it('draws an illustration beside a search that found nothing', () => {
    const { container } = render(<SearchResults query="cauchy" results={[]} />);

    expect(container.querySelector('svg[data-empty-illustration]')).toBeInTheDocument();
  });

  it('invites a search when nothing has been typed', () => {
    render(<SearchResults query="" results={[]} />);

    expect(
      screen.getByText(/Search your sources, tasks, reading and conversations/),
    ).toBeInTheDocument();
  });

  it('never says the word "artefact"', () => {
    const { container } = render(
      <SearchResults
        query="cauchy"
        results={[hit({ kind: 'artefact', id: 'a1', title: 'cloze' })]}
      />,
    );

    expect(container.textContent).not.toMatch(/artefact/i);
  });
});
