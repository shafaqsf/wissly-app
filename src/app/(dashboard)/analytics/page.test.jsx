import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listSubjects: vi.fn(),
  listConceptMastery: vi.fn(),
  gapConcepts: vi.fn(),
  effortByDay: vi.fn(),
  reviewsByDay: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock('@/lib/data/subjects', () => ({ listSubjects: mocks.listSubjects }));
vi.mock('@/lib/data/concepts', () => ({ listConceptMastery: mocks.listConceptMastery }));
vi.mock('@/lib/data/agent-runs', () => ({
  gapConcepts: mocks.gapConcepts,
  effortByDay: mocks.effortByDay,
  reviewsByDay: mocks.reviewsByDay,
}));

import AnalyticsPage from './page';

const SUBJECTS = [
  { id: 's1', title: 'Analysis I' },
  { id: 's2', title: 'Optics' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listSubjects.mockResolvedValue(SUBJECTS);
  mocks.listConceptMastery.mockResolvedValue([
    { id: 'c1', subjectId: 's1', name: 'Cauchy sequence', mastery: 0.2 },
    { id: 'c2', subjectId: 's1', name: 'Compactness', mastery: 0.95 },
  ]);
  mocks.gapConcepts.mockResolvedValue([]);
  mocks.effortByDay.mockResolvedValue([
    { date: '2026-07-25', calls: 2, cost: 1, byCause: { user: 1, schedule: 0 } },
  ]);
  mocks.reviewsByDay.mockResolvedValue([{ date: '2026-07-25', reviews: 3 }]);
});

function params(searchParams = {}) {
  return { searchParams: Promise.resolve(searchParams) };
}

describe('the analytics page', () => {
  it('is called Analytics, not Progress', async () => {
    render(await AnalyticsPage(params()));

    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeInTheDocument();
  });

  it('carries the four surfaces the progress page never had', async () => {
    render(await AnalyticsPage(params()));

    expect(screen.getByRole('region', { name: 'What does not hold yet' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Effort' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mastery')).toBeInTheDocument();
  });

  it('scopes every read to the course the url names', async () => {
    render(await AnalyticsPage(params({ course: 's2' })));

    expect(mocks.listConceptMastery).toHaveBeenCalledWith({}, { subjectId: 's2' });
    expect(mocks.gapConcepts).toHaveBeenCalledWith({}, { subjectId: 's2' });
  });

  it('links each course to its own scoped page', async () => {
    render(await AnalyticsPage(params()));

    expect(screen.getByRole('link', { name: 'Optics' })).toHaveAttribute(
      'href',
      '/analytics?course=s2',
    );
  });

  it('opens on one concept when the url deep-links to it', async () => {
    render(await AnalyticsPage(params({ concept: 'c2' })));

    expect(
      screen.getByRole('heading', { level: 2, name: 'Compactness' }),
    ).toBeInTheDocument();
  });

  it('names the gaps and links them to their material', async () => {
    mocks.gapConcepts.mockResolvedValue([
      {
        id: 'c1',
        subjectId: 's1',
        name: 'Cauchy sequence',
        mastery: 0.2,
        sectionOrdinal: 3,
        source: { id: 'src-1', title: 'Rudin, chapter 3' },
      },
    ]);

    render(await AnalyticsPage(params()));

    expect(screen.getByRole('link', { name: /Rudin, chapter 3/ })).toHaveAttribute(
      'href',
      '/courses/s1?source=src-1',
    );
  });

  it('shows what the agent has cost, split by who asked', async () => {
    render(await AnalyticsPage(params()));

    expect(screen.getByText('The agent decided')).toBeInTheDocument();
  });

  it('shows no percentage, no streak and no progress bar anywhere', async () => {
    const { container } = render(await AnalyticsPage(params()));

    expect(container.textContent).not.toMatch(/%|streak/i);
    expect(container.querySelector('progress')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('invites the learner to add material when there is no course at all', async () => {
    mocks.listSubjects.mockResolvedValue([]);
    mocks.listConceptMastery.mockResolvedValue([]);

    render(await AnalyticsPage(params()));

    expect(screen.getByRole('link', { name: 'Add your first material' })).toHaveAttribute(
      'href',
      '/courses',
    );
  });
});
