import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, expect, test, vi } from 'vitest';

import { App } from './app';
import type { Item } from './items';

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

const row = (id: number, fields: Partial<Item>): Item => ({
  id,
  category: 'reading',
  subtype: null,
  title: `Item ${id}`,
  status: 'wishlist',
  costKrw: null,
  plannedDate: null,
  completedDate: null,
  details: {},
  rating: null,
  subRatings: {},
  review: null,
  link: null,
  ...fields,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

// Answers with `answer(search)`, and keeps every list address it was asked for.
function fakeApi(answer: (search: string) => Response | Promise<Response>) {
  const asked: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/health') return json({ today: '2026-10-31' });
      const search = path.split('?')[1] ?? '';
      asked.push(search);
      return answer(search);
    }),
  );
  return asked;
}

function openAt(path: string) {
  window.history.replaceState(null, '', path);
  render(<App />);
}

const rows = () => within(screen.getByRole('region', { name: 'Items table' })).getAllByRole('row');

async function choose(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

test('the main menu opens the table, which shows every column', async () => {
  fakeApi(() =>
    json({
      items: [
        row(1, {
          title: '라 보엠',
          category: 'stage',
          status: 'done',
          costKrw: 150000,
          plannedDate: '2026-09-01',
          completedDate: '2026-09-02',
          rating: 4.5,
        }),
      ],
    }),
  );
  openAt('/');
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Table view' }));
  expect(await screen.findByRole('link', { name: '라 보엠' })).toHaveAttribute(
    'href',
    '/bucket-list/stage',
  );
  const cells = within(rows()[1])
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
  expect(cells).toEqual([
    '라 보엠',
    'Stage',
    'Done',
    '₩150,000',
    'September 1, 2026',
    'September 2, 2026',
    '4.5',
  ]);
});

test('changing a filter asks the server again and refreshes the table', async () => {
  const asked = fakeApi((search) =>
    json({
      items: search.includes('category=travel') ? [row(2, { title: '교토' })] : [row(1, {})],
    }),
  );
  openAt('/table');
  await screen.findByRole('link', { name: 'Item 1' });
  await choose('Category', 'Travel');
  expect(await screen.findByRole('link', { name: '교토' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Item 1' })).toBeNull();
  expect(asked.at(-1)).toBe('category=travel');
  expect(window.location.search).toBe('?category=travel');

  await choose('Category', 'All');
  await screen.findByRole('link', { name: 'Item 1' });
  expect(window.location.search).toBe('');
});

test('the coffee category is a table filter and names its rows', async () => {
  const asked = fakeApi((search) =>
    json({
      items: search.includes('category=coffee')
        ? [row(3, { category: 'coffee', title: '케냐 AA' })]
        : [row(1, {})],
    }),
  );
  openAt('/table');
  await screen.findByRole('link', { name: 'Item 1' });
  await choose('Category', 'Coffee');
  const link = await screen.findByRole('link', { name: '케냐 AA' });
  expect(link).toHaveAttribute('href', '/bucket-list/coffee');
  expect(link.closest('tr')).toHaveTextContent('Coffee');
  expect(asked.at(-1)).toBe('category=coffee');
});

test('filters in the address are used, shown, and kept', async () => {
  const search =
    'q=%ED%97%A4%EC%84%B8&status=done&from=2026-01-01&to=2026-12-31&costMin=1000&costMax=2000';
  const asked = fakeApi(() => json({ items: [] }));
  openAt(`/table?${search}`);
  expect(await screen.findByText('No items match the filters')).toBeInTheDocument();
  expect(asked).toEqual([search]);
  expect(screen.getByLabelText('Search (title, category details)')).toHaveValue('헤세');
  expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Done');
  expect(screen.getByLabelText('Period start')).toHaveValue('2026-01-01');
  expect(screen.getByLabelText('Period end')).toHaveValue('2026-12-31');
  expect(screen.getByLabelText('Minimum cost (KRW)')).toHaveValue('1000');
  expect(screen.getByLabelText('Maximum cost (KRW)')).toHaveValue('2000');
});

test('text filters apply on Enter or leaving the field, not while typing', async () => {
  const asked = fakeApi(() => json({ items: [] }));
  openAt('/table');
  await screen.findByText('No items match the filters');
  const field = screen.getByLabelText('Search (title, category details)');
  fireEvent.change(field, { target: { value: ' 헤세 ' } });
  expect(asked).toEqual(['']);
  fireEvent.keyDown(field, { key: 'Enter' });
  await waitFor(() => expect(window.location.search).toBe('?q=%ED%97%A4%EC%84%B8'));

  const cost = screen.getByLabelText('Minimum cost (KRW)');
  fireEvent.change(cost, { target: { value: '1000' } });
  fireEvent.blur(cost);
  await waitFor(() =>
    expect(new URLSearchParams(window.location.search).get('costMin')).toBe('1000'),
  );
  await waitFor(() => expect(asked.at(-1)).toContain('costMin=1000'));
});

test('a date filter applies on leaving the field, not while it is typed', async () => {
  const asked = fakeApi(() => json({ items: [] }));
  openAt('/table');
  await screen.findByText('No items match the filters');
  const field = screen.getByLabelText('Period end');
  fireEvent.change(field, { target: { value: '2026-03-02' } });
  fireEvent.change(field, { target: { value: '2026-03-28' } });
  expect(asked).toEqual(['']);
  fireEvent.blur(field);
  await waitFor(() => expect(asked.at(-1)).toBe('to=2026-03-28'));
  expect(asked).toHaveLength(2);
});

test('a half-typed date keeps the existing condition, until the conditions are cleared', async () => {
  const asked = fakeApi(() => json({ items: [] }));
  openAt('/table?to=2026-03-28&status=done');
  await screen.findByText('No items match the filters');
  const field = screen.getByLabelText<HTMLInputElement>('Period end');
  // jsdom has no partial date input; this is how a browser reports one.
  fireEvent.change(field, { target: { value: '' } });
  Object.defineProperty(field, 'validity', { configurable: true, value: { badInput: true } });
  fireEvent.blur(field);
  fireEvent.keyDown(field, { key: 'Enter' });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(asked).toEqual(['to=2026-03-28&status=done']);
  expect(window.location.search).toBe('?to=2026-03-28&status=done');

  const setValue = vi.fn();
  Object.defineProperty(field, 'value', { configurable: true, get: () => '', set: setValue });
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await waitFor(() => expect(window.location.search).toBe(''));
  await waitFor(() => expect(setValue).toHaveBeenLastCalledWith(''));
});

test('leaving a field and pressing a header before a render keeps both changes', async () => {
  const asked = fakeApi(() => json({ items: [row(1, { title: 'e' })] }));
  openAt('/table');
  await screen.findByRole('link', { name: 'e' });
  const field = screen.getByLabelText('Search (title, category details)');
  fireEvent.change(field, { target: { value: 'e' } });
  act(() => {
    fireEvent.blur(field);
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
  });
  await waitFor(() => expect(asked.at(-1)).toBe('q=e&sort=title&order=asc'));
  expect(window.location.search).toBe('?q=e&sort=title&order=asc');
});

test('the retry button stays on screen and keeps the focus while retrying', async () => {
  let release: (response: Response) => void = () => {};
  const held = new Promise<Response>((resolve) => {
    release = resolve;
  });
  let first = true;
  fakeApi(() => {
    if (first) {
      first = false;
      return json({ error: 'A server error occurred' }, 500);
    }
    return held;
  });
  openAt('/table');
  const button = await screen.findByRole('button', { name: 'Try again' });
  button.focus();
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'true'));
  expect(button).toBeInTheDocument();
  expect(document.activeElement).toBe(button);
  release(json({ items: [row(1, {})] }));
  expect(await screen.findByRole('link', { name: 'Item 1' })).toBeInTheDocument();
});

test('applying a filter keeps the focus in its field', async () => {
  fakeApi(() => json({ items: [] }));
  openAt('/table');
  await screen.findByText('No items match the filters');
  const field = screen.getByLabelText('Search (title, category details)');
  field.focus();
  fireEvent.change(field, { target: { value: '헤세' } });
  fireEvent.keyDown(field, { key: 'Enter' });
  await waitFor(() => expect(window.location.search).toContain('q='));
  expect(screen.getByLabelText('Search (title, category details)')).toBe(field);
  expect(document.activeElement).toBe(field);
});

test('a search for the word "any" is a normal search', async () => {
  const asked = fakeApi(() => json({ items: [] }));
  openAt('/table');
  await screen.findByText('No items match the filters');
  const field = screen.getByLabelText('Search (title, category details)');
  fireEvent.change(field, { target: { value: 'any' } });
  fireEvent.keyDown(field, { key: 'Enter' });
  await waitFor(() => expect(asked.at(-1)).toBe('q=any'));
});

test('clearing a field removes its condition', async () => {
  const asked = fakeApi(() => json({ items: [] }));
  openAt('/table?q=abc&costMin=5');
  await screen.findByText('No items match the filters');
  const field = screen.getByLabelText('Search (title, category details)');
  fireEvent.change(field, { target: { value: '' } });
  fireEvent.blur(field);
  await waitFor(() => expect(asked.at(-1)).toBe('costMin=5'));
});

test('a failure can be retried with the same conditions, without an empty notice', async () => {
  let online = false;
  const asked = fakeApi(() =>
    online ? json({ items: [row(1, {})] }) : json({ error: 'A server error occurred' }, 500),
  );
  openAt('/table?status=done');
  expect(await screen.findByRole('alert')).toHaveTextContent('A server error occurred');
  expect(screen.queryByText('No items match the filters')).toBeNull();
  online = true;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('link', { name: 'Item 1' })).toBeInTheDocument();
  expect(asked).toEqual(['status=done', 'status=done']);
  expect(screen.queryByRole('alert')).toBeNull();
});

test('the empty notice waits for the answer', async () => {
  let release: (response: Response) => void = () => {};
  const held = new Promise<Response>((resolve) => {
    release = resolve;
  });
  fakeApi((search) => (search ? json({ items: [] }) : held));
  openAt('/table?q=zzzz');
  await screen.findByText('No items match the filters');
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await waitFor(() => expect(screen.queryByText('No items match the filters')).toBeNull());
  expect(document.activeElement).toBe(screen.getByLabelText('Search (title, category details)'));
  release(json({ items: [row(1, {})] }));
  expect(await screen.findByRole('link', { name: 'Item 1' })).toBeInTheDocument();
});

test('going back restores the conditions in the fields', async () => {
  fakeApi(() => json({ items: [] }));
  openAt('/table?q=abc');
  await screen.findByText('No items match the filters');
  const field = screen.getByLabelText('Search (title, category details)');
  expect(field).toHaveValue('abc');
  await act(async () => {
    window.history.pushState(null, '', '/table?q=xyz');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(field).toHaveValue('xyz');
});

test('a column header sorts, and sorts the other way the second time', async () => {
  const asked = fakeApi(() => json({ items: [row(1, {})] }));
  openAt('/table');
  await screen.findByRole('link', { name: 'Item 1' });
  fireEvent.click(screen.getByRole('button', { name: 'Cost' }));
  await waitFor(() => expect(asked.at(-1)).toBe('sort=costKrw&order=asc'));
  expect(await screen.findByRole('columnheader', { name: /Cost/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  fireEvent.click(screen.getByRole('button', { name: /Cost/ }));
  await waitFor(() => expect(asked.at(-1)).toBe('sort=costKrw&order=desc'));
  await waitFor(() =>
    expect(screen.getByRole('columnheader', { name: /Cost/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    ),
  );
});

test('a server validation error is shown in Korean and the last rows stay', async () => {
  fakeApi((search) =>
    search.includes('costMin')
      ? json({ error: 'Minimum cost must be a whole number from 0 to 2147483647' }, 400)
      : json({ items: [row(1, {})] }),
  );
  openAt('/table');
  await screen.findByRole('link', { name: 'Item 1' });
  const cost = screen.getByLabelText('Minimum cost (KRW)');
  fireEvent.change(cost, { target: { value: 'expensive' } });
  fireEvent.blur(cost);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Minimum cost must be a whole number from 0 to 2147483647',
  );
  expect(screen.getByRole('link', { name: 'Item 1' })).toBeInTheDocument();
});

test('clearing the conditions empties the address and the fields', async () => {
  fakeApi(() => json({ items: [row(1, {})] }));
  openAt('/table?q=abc&status=done');
  await screen.findByRole('link', { name: 'Item 1' });
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await waitFor(() => expect(window.location.search).toBe(''));
  expect(screen.getByLabelText('Search (title, category details)')).toHaveValue('');
  expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('All');
  expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
});

test('a slow answer for an old filter cannot replace the current one', async () => {
  let release: (response: Response) => void = () => {};
  const held = new Promise<Response>((resolve) => {
    release = resolve;
  });
  fakeApi((search) =>
    search === 'status=done' ? held : json({ items: [row(2, { title: 'Current filters' })] }),
  );
  openAt('/table?status=done');
  await choose('Status', 'Want to do');
  expect(await screen.findByRole('link', { name: 'Current filters' })).toBeInTheDocument();
  await act(async () => {
    release(json({ items: [row(1, { title: 'Old filters' })] }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(screen.getByRole('link', { name: 'Current filters' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Old filters' })).toBeNull();
});
