import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { shiftMonth } from './calendar-month';
import { json, openAt } from './test/app';

const item = (fields: Record<string, unknown>) => ({
  category: 'reading',
  subtype: null,
  status: 'wishlist',
  plannedDate: null,
  completedDate: null,
  rating: null,
  ...fields,
});

const MONTHS: Record<string, unknown[]> = {
  '2026-11': [
    item({ id: 1, title: 'Demian', plannedDate: '2026-11-03' }),
    item({
      id: 2,
      title: 'Parasite',
      category: 'screen',
      subtype: 'movie',
      status: 'done',
      plannedDate: '2026-11-05',
      completedDate: '2026-11-08',
      rating: 4.5,
    }),
  ],
  '2026-12': [
    item({
      id: 7,
      title: 'La Boheme',
      category: 'stage',
      subtype: 'opera',
      status: 'done',
      completedDate: '2026-12-24',
      rating: 5,
    }),
  ],
};

// Today is November 10, 2026 in Seoul (the morning of the same day in UTC).
function fakeApi({ fail = false } = {}) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-10T03:00:00Z'));
  const asked: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => {
      if (path === '/api/health') return Promise.resolve(json({ today: '2026-11-10' }));
      const month = /^\/api\/calendar\?month=(\d{4}-\d{2})$/.exec(path)?.[1];
      if (!month) return Promise.resolve(json({ error: 'API not found' }, 404));
      asked.push(month);
      return Promise.resolve(
        fail ? json({ error: 'Server error' }, 500) : json({ month, items: MONTHS[month] ?? [] }),
      );
    }),
  );
  return asked;
}

test('the calendar opens on this month and places items on their planned and completed days', async () => {
  const asked = fakeApi();
  openAt('/calendar');
  expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
  await waitFor(() => expect(window.location.pathname).toBe('/calendar/2026-11'));
  const days = await screen.findByRole('list', { name: 'Days of November 2026' });
  // Planned and done are told apart by words, not only by how they look.
  expect(
    within(days).getByRole('button', { name: 'November 3, 2026: 1 planned' }),
  ).toBeInTheDocument();
  expect(
    within(days).getByRole('button', { name: 'November 5, 2026: 1 planned' }),
  ).toBeInTheDocument();
  expect(within(days).getByRole('button', { name: 'November 8, 2026: 1 done' })).toHaveTextContent(
    'Done: Parasite',
  );
  // A day with nothing on it is not a stop for the keyboard.
  expect(within(days).getAllByRole('button')).toHaveLength(3);
  expect(asked).toEqual(['2026-11']);
});

test('moving to next month and opening a day shows its items with a link to each', async () => {
  const asked = fakeApi();
  openAt('/calendar/2026-11');
  await screen.findByRole('list', { name: 'Days of November 2026' });

  const nextMonth = screen.getByRole('link', { name: 'Next month' });
  nextMonth.focus();
  fireEvent.click(nextMonth);
  const days = await screen.findByRole('list', { name: 'Days of December 2026' });
  expect(window.location.pathname).toBe('/calendar/2026-12');
  // The link stays on the page, so a keyboard user can keep pressing it.
  expect(screen.getByRole('link', { name: 'Next month' })).toHaveFocus();
  expect(asked).toEqual(['2026-11', '2026-12']);

  fireEvent.click(within(days).getByRole('button', { name: 'December 24, 2026: 1 done' }));
  const dialog = within(await screen.findByRole('dialog', { name: 'December 24, 2026' }));
  expect(window.location.search).toBe('?day=2026-12-24');
  const link = dialog.getByRole('link', { name: 'La Boheme' });
  expect(link).toHaveAttribute('href', '/bucket-list/stage#item-7');
  expect(dialog.getByText('Done · Stage · Rating 5/5')).toBeInTheDocument();

  fireEvent.click(link);
  await waitFor(() => expect(window.location.pathname).toBe('/bucket-list/stage'));
});

test('a reload keeps the open day, and closing it returns to the day', async () => {
  fakeApi();
  openAt('/calendar/2026-11?day=2026-11-05');
  const dialog = within(await screen.findByRole('dialog', { name: 'November 5, 2026' }));
  expect(dialog.getByText('Planned · Movies & TV')).toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(window.location.pathname + window.location.search).toBe('/calendar/2026-11');
  // The address opened the dialog, so the focus goes back to the day it showed.
  expect(screen.getByRole('button', { name: 'November 5, 2026: 1 planned' })).toHaveFocus();
});

test('a month with nothing in it says so, and "This month" goes back', async () => {
  fakeApi();
  openAt('/calendar/2027-02');
  expect(
    await screen.findByText('Nothing is planned or done in February 2027.'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'This month' }));
  expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
});

test('an address that is not a month goes to this month', async () => {
  fakeApi();
  openAt('/calendar/2026-13');
  await waitFor(() => expect(window.location.pathname).toBe('/calendar/2026-11'));
});

test('a failed load says so and offers a retry', async () => {
  fakeApi({ fail: true });
  openAt('/calendar/2026-11');
  expect(await screen.findByText('Server error')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

test('months step across years and stop at the ends of the four-digit years', () => {
  expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  expect(shiftMonth('0001-01', -1)).toBeNull();
  expect(shiftMonth('9999-12', 1)).toBeNull();
});
