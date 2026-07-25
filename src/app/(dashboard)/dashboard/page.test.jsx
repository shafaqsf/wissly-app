import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* The panels are tested on their own data in `panels.test.jsx`. What is left
   for the page is composition, and composition is the thing that would break
   quietly: a panel awaiting outside its own boundary holds up the other six,
   and nothing about the screen says so. */

const stub = (name) =>
  function Stub() {
    return <section aria-label={name}>{name}</section>;
  };

const pending = () =>
  function Pending() {
    // A component that never resolves, so the page shows what it shows while
    // its data is in flight.
    throw new Promise(() => {});
  };

function mockPanels(factory) {
  vi.doMock('./panels', () => ({
    ActionPanel: factory('The action'),
    AgentChangesPanel: factory('What the agent changed'),
    WeakestPanel: factory('Weakest'),
    CoursesPanel: factory('Courses'),
    RecentlyPanel: factory('Recently'),
    WeekPanel: factory('This week'),
    EffortPanel: factory('Effort'),
  }));
}

const ORDER = [
  'The action',
  'What the agent changed',
  'Weakest',
  'Courses',
  'Recently',
  'This week',
  'Effort',
];

describe('the dashboard', () => {
  it('answers "what now" in reading order, every surface an entrance', async () => {
    vi.resetModules();
    mockPanels(stub);
    const { default: DashboardPage } = await import('./page');

    render(<DashboardPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();

    const named = screen
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-label'));

    expect(named).toEqual(ORDER);
  });

  it('gives every panel its own boundary, so a slow one holds up nothing else', async () => {
    vi.resetModules();
    mockPanels(pending);
    const { default: DashboardPage } = await import('./page');

    render(<DashboardPage />);

    const busy = screen
      .getAllByRole('region', { busy: true })
      .map((region) => region.getAttribute('aria-label'));

    expect(busy).toEqual(ORDER);
  });
});
