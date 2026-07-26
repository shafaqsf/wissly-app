import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dueCounts: vi.fn(),
  recentAgentActions: vi.fn(),
  effortByDay: vi.fn(),
  reviewsByDay: vi.fn(),
  listConceptMastery: vi.fn(),
  listCourses: vi.fn(),
  listSources: vi.fn(),
  listArtefacts: vi.fn(),
  listConversations: vi.fn(),
  streakFor: vi.fn(),
  undoAgentAction: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock('@/lib/data/agent-runs', () => ({
  dueCounts: mocks.dueCounts,
  recentAgentActions: mocks.recentAgentActions,
  effortByDay: mocks.effortByDay,
  reviewsByDay: mocks.reviewsByDay,
}));
vi.mock('@/lib/data/concepts', () => ({ listConceptMastery: mocks.listConceptMastery }));
vi.mock('@/lib/data/courses', () => ({ listCourses: mocks.listCourses }));
vi.mock('@/lib/data/sources', () => ({ listSources: mocks.listSources }));
vi.mock('@/lib/data/artefacts', () => ({
  listArtefacts: mocks.listArtefacts,
  RECALL_FORMATS: ['flashcard', 'cloze', 'multiple_choice', 'open_question'],
}));
vi.mock('@/lib/data/conversations', () => ({ listConversations: mocks.listConversations }));
vi.mock('@/lib/data/streak', () => ({ streakFor: mocks.streakFor }));
vi.mock('./actions', () => ({ undoAgentAction: mocks.undoAgentAction }));

import {
  ActionPanel,
  AgentChangesPanel,
  CoursesPanel,
  EffortPanel,
  RecentlyPanel,
  StreakPanel,
  WeakestPanel,
  WeekPanel,
} from './panels';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dueCounts.mockResolvedValue({ due: 12, overdue: 3 });
  mocks.recentAgentActions.mockResolvedValue([]);
  mocks.effortByDay.mockResolvedValue([
    { date: '2026-07-25', calls: 2, cost: 1.5 },
  ]);
  mocks.reviewsByDay.mockResolvedValue([{ date: '2026-07-25', reviews: 3 }]);
  mocks.listConceptMastery.mockResolvedValue([]);
  mocks.listCourses.mockResolvedValue([]);
  mocks.listSources.mockResolvedValue([]);
  mocks.listArtefacts.mockResolvedValue([]);
  mocks.listConversations.mockResolvedValue([]);
  mocks.streakFor.mockResolvedValue({ days: 0, milestone: null });
});

describe('the action', () => {
  it('says how much is due and how much of it is late', async () => {
    render(await ActionPanel());

    expect(screen.getByText('12 tasks due, 3 overdue')).toBeInTheDocument();
  });

  it('offers the round itself, not a description of it', async () => {
    render(await ActionPanel());

    expect(screen.getByRole('link', { name: 'Start a round' })).toHaveAttribute(
      'href',
      '/tasks/due',
    );
  });

  it('offers the next step when nothing is due', async () => {
    mocks.dueCounts.mockResolvedValue({ due: 0, overdue: 0 });

    render(await ActionPanel());

    expect(screen.getByRole('link', { name: 'Make some tasks' })).toHaveAttribute(
      'href',
      '/tasks',
    );
  });
});

describe('while you were away', () => {
  const action = {
    id: 'act-1',
    runId: 'run-1',
    tool: 'make_artefacts',
    args: { count: 4, format: 'flashcard' },
    result: null,
    createdAt: '2026-07-25T09:00:00.000Z',
  };

  it('says what the agent changed, in words', async () => {
    mocks.recentAgentActions.mockResolvedValue([action]);

    render(await AgentChangesPanel());

    expect(
      screen.getByRole('link', { name: /Made 4 flashcards from your material/ }),
    ).toHaveAttribute('href', '/tasks');
  });

  it('offers to take every one of them back', async () => {
    mocks.recentAgentActions.mockResolvedValue([action]);

    render(await AgentChangesPanel());

    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('act-1')).toHaveAttribute('name', 'actionId');
  });

  it('says nothing happened rather than showing an empty list', async () => {
    render(await AgentChangesPanel());

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText(/has not changed anything yet/)).toBeInTheDocument();
  });
});

describe('weakest', () => {
  const concepts = [
    { id: 'c1', subjectId: 's1', name: 'A', mastery: 0.9 },
    { id: 'c2', subjectId: 's1', name: 'B', mastery: 0.1 },
    { id: 'c3', subjectId: 's1', name: 'C', mastery: 0.2 },
    { id: 'c4', subjectId: 's1', name: 'D', mastery: 0.3 },
    { id: 'c5', subjectId: 's1', name: 'E', mastery: 0.4 },
    { id: 'c6', subjectId: 's1', name: 'F', mastery: 0.5 },
  ];

  it('shows five, weakest first', async () => {
    mocks.listConceptMastery.mockResolvedValue(concepts);

    render(await WeakestPanel());

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(links[0]).toHaveAccessibleName(/B/);
  });

  it('deep-links each concept into analytics', async () => {
    mocks.listConceptMastery.mockResolvedValue(concepts);

    render(await WeakestPanel());

    expect(screen.getAllByRole('link')[0]).toHaveAttribute(
      'href',
      '/analytics?concept=c2',
    );
  });

  it('never lets a mark be the only carrier of meaning', async () => {
    mocks.listConceptMastery.mockResolvedValue(concepts.slice(0, 1));

    render(await WeakestPanel());

    expect(screen.getByText('Mastered')).toBeInTheDocument();
  });

  it('offers the first round when nothing has been measured', async () => {
    render(await WeakestPanel());

    expect(screen.getByRole('link', { name: 'Start a round' })).toHaveAttribute(
      'href',
      '/tasks/due',
    );
  });
});

describe('courses', () => {
  it('says the size of each course in words, and leads to it', async () => {
    mocks.listCourses.mockResolvedValue([
      { id: 's1', title: 'Analysis I', sources: 2, concepts: 12, settled: 3 },
    ]);

    render(await CoursesPanel());

    expect(screen.getByRole('link', { name: /Analysis I/ })).toHaveAttribute(
      'href',
      '/courses/s1',
    );
    expect(screen.getByText('2 sources · 3 of 12 concepts settled')).toBeInTheDocument();
  });

  it('carries no grain — the viewport spends its one field on Weakest', async () => {
    mocks.listCourses.mockResolvedValue([
      { id: 's1', title: 'Analysis I', sources: 2, concepts: 12, settled: 3 },
    ]);

    const { container } = render(await CoursesPanel());

    expect(container.querySelectorAll('.grain-mark')).toHaveLength(0);
  });

  it('invites a first course when there is none', async () => {
    render(await CoursesPanel());

    expect(screen.getByRole('link', { name: 'Start a course' })).toHaveAttribute(
      'href',
      '/courses',
    );
  });
});

describe('recently', () => {
  it('leads the last of each thing to its own place', async () => {
    mocks.listSources.mockResolvedValue([
      { id: 'src-1', subject_id: 's1', title: 'Rudin, chapter 3' },
    ]);
    mocks.listArtefacts.mockResolvedValue([
      { id: 'a1', subject_id: 's1', format: 'flashcard' },
    ]);
    mocks.listConversations.mockResolvedValue([{ id: 'conv-1', title: 'σ-algebras' }]);

    render(await RecentlyPanel());

    expect(screen.getByRole('link', { name: /Rudin, chapter 3/ })).toHaveAttribute(
      'href',
      '/courses/s1?source=src-1',
    );
    expect(screen.getByRole('link', { name: /Flashcard/ })).toHaveAttribute(
      'href',
      '/tasks',
    );
    expect(screen.getByRole('link', { name: /σ-algebras/ })).toHaveAttribute(
      'href',
      '/dashboard?conversation=conv-1',
    );
  });

  it('offers the first upload when there is no history at all', async () => {
    render(await RecentlyPanel());

    expect(screen.getByRole('link', { name: 'Add material' })).toHaveAttribute(
      'href',
      '/courses',
    );
  });
});

describe('streak', () => {
  it('says how many days in a row, in a real number', async () => {
    mocks.streakFor.mockResolvedValue({ days: 12, milestone: 7 });

    render(await StreakPanel());

    expect(screen.getByText('12 days streak')).toBeInTheDocument();
    expect(screen.getByText('7-day milestone reached')).toBeInTheDocument();
  });

  it('uses the singular for one day', async () => {
    mocks.streakFor.mockResolvedValue({ days: 1, milestone: null });

    render(await StreakPanel());

    expect(screen.getByText('1 day streak')).toBeInTheDocument();
  });

  it('invites a round instead of showing a zero-day streak', async () => {
    mocks.streakFor.mockResolvedValue({ days: 0, milestone: null });

    render(await StreakPanel());

    expect(screen.queryByText(/streak$/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a round' })).toHaveAttribute(
      'href',
      '/tasks/due',
    );
  });
});

describe('this week', () => {
  it('plots the reviews of each day and leads to analytics', async () => {
    render(await WeekPanel());

    expect(screen.getByRole('list', { name: 'Reviews per day' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      '/analytics',
    );
  });

  it('shows no percentage and no streak', async () => {
    const { container } = render(await WeekPanel());

    expect(container.textContent).not.toMatch(/%|streak/i);
  });
});

describe('effort', () => {
  it('shows what the agent has cost, where the learner passes daily', async () => {
    render(await EffortPanel());

    expect(screen.getByText('$1.50')).toBeInTheDocument();
    expect(screen.getByText('2 model calls over seven days')).toBeInTheDocument();
  });
});
