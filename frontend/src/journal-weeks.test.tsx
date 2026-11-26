import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { json, openAt } from './test/app';

// #235: the Week and 12-week views. 2026-11-10 is a Tuesday, so its week is 2026-11-08 to 2026-11-14.
const TODAY = '2026-11-10';

function fakeApi() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-10T03:00:00Z'));
  const asked: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => {
      asked.push(path);
      if (path === '/api/health') return Promise.resolve(json({ today: TODAY }));
      if (path.startsWith('/api/journal?from=')) {
        return Promise.resolve(
          json({
            entries: [
              { date: '2026-11-10', title: 'Saw a play', body: 'Long text' },
              { date: '2026-11-09', title: null, body: 'A quiet day.\nSecond line' },
            ],
            nextOffset: null,
            total: 2,
          }),
        );
      }
      if (path.startsWith('/api/calendar?month=')) {
        return Promise.resolve(
          json({
            month: path.slice(-7),
            items: [
              { id: 7, category: 'movies', title: 'Dune', completedDate: '2026-11-10' },
              { id: 8, category: 'books', title: 'Out of week', completedDate: '2026-11-20' },
            ],
          }),
        );
      }
      return Promise.resolve(json({ error: 'not faked' }, 404));
    }),
  );
  return asked;
}

test('the week lists each day with its entry and what was completed', async () => {
  const asked = fakeApi();
  openAt('/week');
  await waitFor(() => expect(window.location.pathname).toBe('/week/2026-11-08'));
  const days = await screen.findByRole('list', { name: 'Days of the week' });
  expect(within(days).getByText('Saw a play')).toBeInTheDocument();
  expect(within(days).getByText('A quiet day.')).toBeInTheDocument();
  expect(within(days).getByRole('link', { name: 'Dune' })).toBeInTheDocument();
  expect(within(days).queryByText('Out of week')).toBeNull();
  expect(within(days).getAllByText('No entry')).toHaveLength(5);
  expect(asked).toContain('/api/journal?from=2026-11-08&to=2026-11-14&limit=100');
  // Today's week has no next week.
  expect(screen.queryByRole('link', { name: 'Next week' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Previous week' }));
  await waitFor(() => expect(window.location.pathname).toBe('/week/2026-11-01'));
  expect(await screen.findByRole('link', { name: 'Next week' })).toBeInTheDocument();
});

test('a date inside a week or a wrong date goes to the Sunday that starts the week', async () => {
  fakeApi();
  openAt('/week/2026-11-12');
  await waitFor(() => expect(window.location.pathname).toBe('/week/2026-11-08'));
});

test('12 weeks count the days written in each week and open the week', async () => {
  fakeApi();
  openAt('/weeks');
  const weeks = await screen.findByRole('list', { name: 'Weeks' });
  expect(within(weeks).getAllByRole('listitem')).toHaveLength(12);
  const latest = within(weeks).getAllByRole('link')[0];
  expect(latest).toHaveTextContent('2 of 7 days written');
  fireEvent.click(latest);
  await waitFor(() => expect(window.location.pathname).toBe('/week/2026-11-08'));
});
