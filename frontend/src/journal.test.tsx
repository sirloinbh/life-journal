import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { json, openAt } from './test/app';
import { findLive } from './test/live';

type Entry = { date: string; body: string; createdAt: string; updatedAt: string };

const TODAY = '2026-11-10';

// An in-memory journal API. Its entries outlive a render, like the server's do across a reload.
function fakeApi(initial: Record<string, string> = {}) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-10T03:00:00Z'));
  const entries = new Map<string, Entry>(
    Object.entries(initial).map(([date, body]) => [
      date,
      { date, body, createdAt: `${date}T12:00:00Z`, updatedAt: `${date}T12:00:00Z` },
    ]),
  );
  const writes: { method: string; path: string; body?: unknown }[] = [];
  const api = { entries, writes, failSave: null as string | null };
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init: { method?: string; body?: string } = {}) => {
      const method = init.method ?? 'GET';
      if (path === '/api/health') return Promise.resolve(json({ today: TODAY }));
      const list = /^\/api\/journal\?limit=(\d+)&offset=(\d+)$/.exec(path);
      if (list && method === 'GET') {
        const [limit, offset] = [Number(list[1]), Number(list[2])];
        const sorted = [...entries.values()].sort((a, b) => b.date.localeCompare(a.date));
        const page = sorted.slice(offset, offset + limit);
        const next = offset + page.length;
        return Promise.resolve(
          json({
            entries: page,
            nextOffset: page.length > 0 && next < sorted.length ? next : null,
            total: sorted.length,
          }),
        );
      }
      const date = /^\/api\/journal\/(\d{4}-\d{2}-\d{2})$/.exec(path)?.[1];
      if (!date) return Promise.resolve(json({ error: 'API not found' }, 404));
      const found = entries.get(date);
      if (method === 'GET') {
        return Promise.resolve(
          found ? json(found) : json({ error: 'Journal entry not found' }, 404),
        );
      }
      const body = init.body ? (JSON.parse(init.body) as { body: string }) : undefined;
      writes.push({ method, path, body });
      if (method === 'DELETE') {
        if (!found) return Promise.resolve(json({ error: 'Journal entry not found' }, 404));
        entries.delete(date);
        return Promise.resolve(json(undefined, 204));
      }
      if (api.failSave) return Promise.resolve(json({ error: api.failSave }, 400));
      const text = (body?.body ?? '').trim();
      const now = new Date().toISOString();
      const entry = { date, body: text, createdAt: found?.createdAt ?? now, updatedAt: now };
      entries.set(date, entry);
      return Promise.resolve(json(entry, found ? 200 : 201));
    }),
  );
  return api;
}

const editor = () => screen.findByLabelText(/^Entry for /);
const pastEntries = () => screen.findByRole('list', { name: 'Past entries' });

test('writing an entry for today keeps it after a reload and lists it', async () => {
  const api = fakeApi({ '2026-11-08': 'Saw a play.\nThe second act was better.' });
  openAt('/journal');
  await waitFor(() => expect(window.location.pathname).toBe(`/journal/${TODAY}`));
  const field = await editor();
  expect(field).toHaveAccessibleName('Entry for November 10, 2026');
  expect(field).toHaveValue('');
  // No entry yet, so nothing to delete; today has no next day.
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Next day' })).toBeNull();

  fireEvent.change(field, { target: { value: '  A quiet day.\nRead in the park.  ' } });
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Saved')).toBeInTheDocument();
  expect(field).toHaveValue('A quiet day.\nRead in the park.');
  expect(screen.queryByText('Unsaved changes')).toBeNull();
  expect(api.writes).toEqual([
    {
      method: 'PUT',
      path: `/api/journal/${TODAY}`,
      body: { body: '  A quiet day.\nRead in the park.  ' },
    },
  ]);

  // A reload asks the server again and finds the entry in the editor and at the top of the list.
  cleanup();
  openAt(`/journal/${TODAY}`);
  expect(await editor()).toHaveValue('A quiet day.\nRead in the park.');
  const list = await pastEntries();
  const links = within(list).getAllByRole('link');
  expect(links.map((link) => link.textContent)).toEqual([
    'November 10, 2026A quiet day.',
    'November 8, 2026Saw a play.',
  ]);
  expect(links[0]).toHaveAttribute('aria-current', 'page');
});

test('saving again on the same day updates the one entry', async () => {
  const api = fakeApi({ [TODAY]: 'First draft' });
  openAt(`/journal/${TODAY}`);
  const field = await editor();
  await waitFor(() => expect(field).toHaveValue('First draft'));
  fireEvent.change(field, { target: { value: 'Second draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Saved')).toBeInTheDocument();
  expect(api.entries.size).toBe(1);
  await waitFor(() =>
    expect(
      within(screen.getByRole('list', { name: 'Past entries' })).getAllByRole('link'),
    ).toHaveLength(1),
  );
  expect(screen.getByRole('list', { name: 'Past entries' })).toHaveTextContent('Second draft');
});

test("a refused save shows the server's message and keeps the text", async () => {
  const api = fakeApi();
  api.failSave = 'Entry text is required';
  openAt(`/journal/${TODAY}`);
  const field = await editor();
  fireEvent.change(field, { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await findLive('alert')).toHaveTextContent('Entry text is required');
  expect(field).toHaveValue('   ');
});

test('past days open from the list, the previous-day link, and the date field', async () => {
  fakeApi({ '2026-11-08': 'Saw a play.', '2026-11-09': 'Rainy.' });
  openAt(`/journal/${TODAY}`);
  fireEvent.click(within(await pastEntries()).getByRole('link', { name: /November 8, 2026/ }));
  await waitFor(() => expect(window.location.pathname).toBe('/journal/2026-11-08'));
  await waitFor(async () => expect(await editor()).toHaveValue('Saw a play.'));

  fireEvent.click(screen.getByRole('link', { name: 'Next day' }));
  await waitFor(async () => expect(await editor()).toHaveValue('Rainy.'));

  fireEvent.click(screen.getByRole('link', { name: 'Previous day' }));
  await waitFor(() => expect(window.location.pathname).toBe('/journal/2026-11-08'));

  fireEvent.change(screen.getByLabelText('Go to date'), { target: { value: '2026-11-01' } });
  await waitFor(() => expect(window.location.pathname).toBe('/journal/2026-11-01'));
  expect(await editor()).toHaveValue('');
});

test('a future or unreal date in the address goes to today', async () => {
  fakeApi();
  openAt('/journal/2026-11-11');
  await waitFor(() => expect(window.location.pathname).toBe(`/journal/${TODAY}`));
  cleanup();
  openAt('/journal/2026-02-30');
  await waitFor(() => expect(window.location.pathname).toBe(`/journal/${TODAY}`));
});

test('deleting an entry asks first, then empties the day and the list', async () => {
  const api = fakeApi({ [TODAY]: 'To be deleted' });
  openAt(`/journal/${TODAY}`);
  await waitFor(async () => expect(await editor()).toHaveValue('To be deleted'));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  const dialog = within(await screen.findByRole('dialog'));
  fireEvent.click(dialog.getByRole('button', { name: 'Delete' }));
  expect(await screen.findByText('Deleted')).toBeInTheDocument();
  expect(await editor()).toHaveValue('');
  expect(api.entries.size).toBe(0);
  expect(await screen.findByText('No entries yet.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  // The Delete button is gone, so the focus goes back to the text field.
  await waitFor(async () => expect(await editor()).toHaveFocus());
});

test('the list loads more entries page by page', async () => {
  const many = Object.fromEntries(
    Array.from({ length: 25 }, (_, i) => [
      `2026-10-${String(i + 1).padStart(2, '0')}`,
      `Day ${i + 1}`,
    ]),
  );
  fakeApi(many);
  openAt(`/journal/${TODAY}`);
  const list = await pastEntries();
  expect(within(list).getAllByRole('link')).toHaveLength(20);
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await waitFor(() => expect(within(list).getAllByRole('link')).toHaveLength(25));
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
});
