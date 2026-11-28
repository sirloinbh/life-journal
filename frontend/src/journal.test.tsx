import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { json, openAt } from './test/app';
import { findLive } from './test/live';

type Entry = {
  date: string;
  title: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};
type DayItem = {
  id: number;
  category: string;
  subtype: string | null;
  title: string;
  completedDate: string;
  rating: number | null;
};

const TODAY = '2026-11-10';

// An in-memory journal API. Its entries outlive a render, like the server's do across a reload.
function fakeApi(initial: Record<string, string> = {}, items: DayItem[] = []) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-10T03:00:00Z'));
  const entries = new Map<string, Entry>(
    Object.entries(initial).map(([date, body]) => [
      date,
      {
        date,
        title: null,
        body,
        createdAt: `${date}T12:00:00Z`,
        updatedAt: `${date}T12:00:00Z`,
      },
    ]),
  );
  const writes: { method: string; path: string; body?: unknown }[] = [];
  // The linked item ids of each date.
  const links = new Map<string, number[]>();
  const api = { entries, writes, links, failSave: null as string | null };
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
      const dayItems = /^\/api\/journal\/(\d{4}-\d{2}-\d{2})\/items(?:\/(\d+))?$/.exec(path);
      if (dayItems) {
        const [, day, id] = dayItems;
        const linked = links.get(day) ?? [];
        if (method === 'GET') {
          return Promise.resolve(
            json({
              linked: linked.map((itemId) => items.find((item) => item.id === itemId)),
              suggestions: items.filter(
                (item) => item.completedDate === day && !linked.includes(item.id),
              ),
            }),
          );
        }
        writes.push({ method, path });
        const item = items.find((candidate) => candidate.id === Number(id));
        if (method === 'PUT') {
          if (!entries.has(day)) {
            return Promise.resolve(json({ error: 'Journal entry not found' }, 404));
          }
          if (!item) return Promise.resolve(json({ error: 'Item not found' }, 404));
          links.set(day, [...linked, item.id]);
          return Promise.resolve(json(item, 201));
        }
        if (!item || !linked.includes(item.id)) {
          return Promise.resolve(json({ error: 'Link not found' }, 404));
        }
        links.set(
          day,
          linked.filter((itemId) => itemId !== item.id),
        );
        return Promise.resolve(json(undefined, 204));
      }
      const date = /^\/api\/journal\/(\d{4}-\d{2}-\d{2})$/.exec(path)?.[1];
      if (!date) return Promise.resolve(json({ error: 'API not found' }, 404));
      const found = entries.get(date);
      if (method === 'GET') {
        return Promise.resolve(
          found ? json(found) : json({ error: 'Journal entry not found' }, 404),
        );
      }
      const body = init.body
        ? (JSON.parse(init.body) as { title: string | null; body: string })
        : undefined;
      writes.push({ method, path, body });
      if (method === 'DELETE') {
        if (!found) return Promise.resolve(json({ error: 'Journal entry not found' }, 404));
        entries.delete(date);
        links.delete(date);
        return Promise.resolve(json(undefined, 204));
      }
      if (api.failSave) return Promise.resolve(json({ error: api.failSave }, 400));
      const text = (body?.body ?? '').trim();
      const now = new Date().toISOString();
      const entry = {
        date,
        title: body?.title?.trim() || null,
        body: text,
        createdAt: found?.createdAt ?? now,
        updatedAt: now,
      };
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
  expect(field).toHaveAccessibleName('Entry for Nov 10, 2026');
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
      body: { title: null, body: '  A quiet day.\nRead in the park.  ' },
    },
  ]);

  // A reload asks the server again and finds the entry in the editor and at the top of the list.
  cleanup();
  openAt(`/journal/${TODAY}`);
  expect(await editor()).toHaveValue('A quiet day.\nRead in the park.');
  const list = await pastEntries();
  const links = within(list).getAllByRole('link');
  expect(links.map((link) => link.textContent)).toEqual([
    'Nov 10, 2026A quiet day.',
    'Nov 8, 2026Saw a play.',
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

test('an optional title is saved trimmed, shown in the list, and removed when cleared', async () => {
  const api = fakeApi({ [TODAY]: 'Body text' });
  openAt(`/journal/${TODAY}`);
  await waitFor(async () => expect(await editor()).toHaveValue('Body text'));
  const title = screen.getByLabelText('Title (optional)');
  expect(title).toHaveValue('');
  expect(title).toHaveAttribute('maxLength', '200');

  fireEvent.change(title, { target: { value: '  공원 산책  ' } });
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Saved')).toBeInTheDocument();
  expect(title).toHaveValue('공원 산책');
  expect(api.writes.at(-1)?.body).toEqual({ title: '공원 산책', body: 'Body text' });
  await waitFor(() =>
    expect(screen.getByRole('list', { name: 'Past entries' })).toHaveTextContent(
      'Nov 10, 2026공원 산책Body text',
    ),
  );

  // A blank title is sent as null, so the entry has none again.
  fireEvent.change(title, { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.writes).toHaveLength(2));
  expect(api.writes.at(-1)?.body).toEqual({ title: null, body: 'Body text' });
  await waitFor(() => expect(api.entries.get(TODAY)?.title).toBeNull());
  expect(title).toHaveValue('');
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
  fireEvent.click(within(await pastEntries()).getByRole('link', { name: /Nov 8, 2026/ }));
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

test('an item completed on the day is suggested, linked to the saved entry, and unlinked', async () => {
  const play: DayItem = {
    id: 7,
    category: 'stage',
    subtype: null,
    title: 'Hamlet',
    completedDate: TODAY,
    rating: 4.5,
  };
  const other: DayItem = { ...play, id: 8, title: 'Another day', completedDate: '2026-11-09' };
  const api = fakeApi({}, [play, other]);
  openAt(`/journal/${TODAY}`);
  const section = within(await screen.findByRole('region', { name: 'Done that day' }));
  const suggested = within(await section.findByRole('list', { name: 'Items to link' }));
  // Only the day's item, with a link to it on the bucket list; no entry yet, so it cannot be linked.
  expect(suggested.getAllByRole('listitem')).toHaveLength(1);
  expect(suggested.getByRole('link', { name: 'Hamlet' })).toHaveAttribute(
    'href',
    '/bucket-list/stage#item-7',
  );
  expect(suggested.getByText(/Rating 4.5\/5/)).toBeInTheDocument();
  expect(section.getByText(/Save the entry first/)).toBeInTheDocument();
  expect(suggested.getByRole('button', { name: 'Link Hamlet' })).toBeDisabled();

  fireEvent.change(await editor(), { target: { value: 'Saw Hamlet.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Saved')).toBeInTheDocument();
  await waitFor(() => expect(suggested.getByRole('button', { name: 'Link Hamlet' })).toBeEnabled());

  fireEvent.click(suggested.getByRole('button', { name: 'Link Hamlet' }));
  expect(await section.findByText('Linked Hamlet')).toBeInTheDocument();
  const linked = within(section.getByRole('list', { name: 'Linked items' }));
  expect(linked.getByRole('link', { name: 'Hamlet' })).toBeInTheDocument();
  expect(section.queryByRole('list', { name: 'Items to link' })).toBeNull();
  // The focus moves to the button that took the pressed one's place.
  await waitFor(() => expect(linked.getByRole('button', { name: 'Unlink Hamlet' })).toHaveFocus());
  expect(api.links.get(TODAY)).toEqual([7]);

  fireEvent.click(linked.getByRole('button', { name: 'Unlink Hamlet' }));
  expect(await section.findByText('Unlinked Hamlet')).toBeInTheDocument();
  expect(section.queryByRole('list', { name: 'Linked items' })).toBeNull();
  await waitFor(() => expect(section.getByRole('button', { name: 'Link Hamlet' })).toHaveFocus());
  expect(api.links.get(TODAY)).toEqual([]);
});

test('a day with nothing completed says so', async () => {
  fakeApi({ '2026-11-08': 'Quiet.' });
  openAt('/journal/2026-11-08');
  const section = within(await screen.findByRole('region', { name: 'Done that day' }));
  expect(
    await section.findByText('No bucket-list items were completed on this day.'),
  ).toBeInTheDocument();
});
