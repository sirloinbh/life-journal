import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { json, openAt } from './test/app';

const KEYS = ['reading', 'screen', 'stage', 'drink', 'travel', 'coffee'];

function yearStats(year: string, counts: number[], extra: Record<string, unknown> = {}) {
  const completed = counts.reduce((sum, count) => sum + count, 0);
  return {
    year,
    completed,
    spendingKrw: 0,
    months: counts.map((total, index) => ({
      month: `${year}-${String(index + 1).padStart(2, '0')}`,
      total,
      categories: Object.fromEntries(KEYS.map((key) => [key, key === 'reading' ? total : 0])),
    })),
    categories: KEYS.map((key) => ({
      category: key,
      completed: key === 'reading' ? completed : 0,
      rated: 0,
      averageRating: null,
      spendingKrw: 0,
    })),
    topRated: [],
    ...extra,
  };
}

const YEARS: Record<string, unknown> = {
  '2026': {
    ...yearStats('2026', [1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
    spendingKrw: 37000,
    categories: [
      { category: 'reading', completed: 2, rated: 2, averageRating: 4.5, spendingKrw: 10000 },
      { category: 'screen', completed: 2, rated: 1, averageRating: 3, spendingKrw: 27000 },
      ...KEYS.slice(2).map((key) => ({
        category: key,
        completed: 0,
        rated: 0,
        averageRating: null,
        spendingKrw: 0,
      })),
    ],
    topRated: [
      {
        id: 4,
        category: 'reading',
        subtype: null,
        title: 'Year-end book',
        rating: 5,
        completedDate: '2026-12-31',
      },
    ],
  },
  '2025': yearStats('2025', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], { spendingKrw: 50000 }),
};

// Today is November 10, 2026 in Seoul.
function fakeApi({ fail = false } = {}) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-10T03:00:00Z'));
  const asked: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => {
      if (path === '/api/health') return Promise.resolve(json({ today: '2026-11-10' }));
      const year = /^\/api\/stats\?year=(\d{4})$/.exec(path)?.[1];
      if (!year) return Promise.resolve(json({ error: 'API not found' }, 404));
      asked.push(year);
      return Promise.resolve(
        fail
          ? json({ error: 'Server error' }, 500)
          : json(
              YEARS[year] ??
                yearStats(
                  year,
                  Array.from({ length: 12 }, () => 0),
                ),
            ),
      );
    }),
  );
  return asked;
}

const statValue = (label: string) =>
  screen
    .getAllByText(label)
    .map((element) => element.closest('[data-slot="stat"]'))
    .find(Boolean)
    ?.querySelector('[data-slot="stat-value"]')?.textContent;

test('the statistics open on this year with counts, spending, averages, and the top items', async () => {
  const asked = fakeApi();
  openAt('/stats');
  expect(await screen.findByRole('heading', { name: '2026' })).toBeInTheDocument();
  await waitFor(() => expect(window.location.pathname).toBe('/stats/2026'));
  await screen.findByRole('list', { name: 'Completed items per month' });
  expect(statValue('Completed')).toBe('4items');
  expect(statValue('Spending')).toBe('₩37,000');

  // The bars write their numbers, and a table holds the same counts by category.
  const bars = screen.getByRole('list', { name: 'Completed items per month' });
  expect(
    within(bars)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual([
    'Jan1 item',
    'Feb0 items',
    'Mar2 items',
    'Apr0 items',
    'May0 items',
    'Jun0 items',
    'Jul0 items',
    'Aug0 items',
    'Sep0 items',
    'Oct0 items',
    'Nov0 items',
    'Dec1 item',
  ]);
  const months = within(screen.getByRole('region', { name: 'Completed per month and category' }));
  const march = months.getByRole('row', { name: /^Mar/ });
  expect(
    within(march)
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual(['2', '0', '0', '0', '0', '0', '2']);

  const byCategory = within(
    screen.getByRole('region', {
      name: 'Completed, average rating, and spending by category',
    }),
  );
  expect(
    within(byCategory.getByRole('row', { name: /^Movies & TV/ }))
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual(['2', '3/5', '₩27,000']);
  expect(
    within(byCategory.getByRole('row', { name: /^Drinks/ }))
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual(['0', 'No ratings', '₩0']);

  const top = within(screen.getByRole('list', { name: 'Top rated' }));
  expect(top.getByRole('link', { name: 'Year-end book' })).toHaveAttribute(
    'href',
    '/bucket-list/reading#item-4',
  );
  expect(top.getByText('Reading · Rating 5/5 · December 31, 2026')).toBeInTheDocument();
  expect(asked).toEqual(['2026']);
});

test('switching the year changes the numbers, and the link keeps the focus', async () => {
  const asked = fakeApi();
  openAt('/stats/2026');
  await screen.findByRole('list', { name: 'Completed items per month' });
  expect(statValue('Completed')).toBe('4items');

  const previous = screen.getByRole('link', { name: 'Previous year' });
  previous.focus();
  fireEvent.click(previous);
  expect(await screen.findByRole('heading', { name: '2025' })).toBeInTheDocument();
  await waitFor(() => expect(statValue('Completed')).toBe('1item'));
  expect(statValue('Spending')).toBe('₩50,000');
  expect(window.location.pathname).toBe('/stats/2025');
  expect(screen.getByRole('link', { name: 'Previous year' })).toHaveFocus();
  expect(screen.getByText('No rated items this year.')).toBeInTheDocument();
  expect(asked).toEqual(['2026', '2025']);
});

test('a year with nothing completed says so, and "This year" goes back', async () => {
  fakeApi();
  openAt('/stats/2030');
  expect(await screen.findByText('Nothing was completed in 2030.')).toBeInTheDocument();
  expect(statValue('Completed')).toBe('0items');
  expect(screen.queryByRole('list', { name: 'Completed items per month' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'This year' }));
  expect(await screen.findByRole('heading', { name: '2026' })).toBeInTheDocument();
});

test('an address that is not a year goes to this year', async () => {
  fakeApi();
  openAt('/stats/26');
  await waitFor(() => expect(window.location.pathname).toBe('/stats/2026'));
});

test('a failed load says so and offers a retry', async () => {
  fakeApi({ fail: true });
  openAt('/stats/2026');
  expect(await screen.findByText('Server error')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
