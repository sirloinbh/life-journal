import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

const TERMS = [
  {
    id: 'wine-tannin',
    domain: 'wine',
    term: 'Tannin',
    original: 'Tannin',
    meaning: 'An astringent compound',
  },
  {
    id: 'wine-terroir',
    domain: 'wine',
    term: 'Terroir',
    original: 'Terroir',
    meaning: 'The growing environment',
  },
  {
    id: 'movie-montage',
    domain: 'movie',
    term: 'Montage',
    original: 'Montage',
    meaning: 'Editing',
  },
  { id: 'opera-aria', domain: 'opera', term: 'Aria', original: 'Aria', meaning: 'A solo song' },
  {
    id: 'musical-number',
    domain: 'musical',
    term: 'Number',
    original: 'Number',
    meaning: 'A song',
  },
];

// An in-memory API. Its learned marks outlive a render, like the server's do across a reload.
function fakeApi() {
  const api = {
    learned: new Set<string>(),
    requests: [] as { method: string; path: string }[],
    failNext: null as { status: number; error: string } | null,
    failList: false,
    changeGate: null as Promise<void> | null,
    holdNextList: null as Promise<void> | null,
    terms: [...TERMS],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: { method?: string } = {}) => {
      const method = init.method ?? 'GET';
      if (path === '/api/health') return json({ today: '2026-11-02' });
      if (method === 'GET') {
        if (api.failList) return json({ error: 'A server error occurred' }, 500);
        // A held list answers with what was true when it was asked.
        const answer = json({
          domains: [
            { key: 'wine', label: 'Wine' },
            { key: 'movie', label: 'Movie' },
            { key: 'opera', label: 'Opera' },
            { key: 'musical', label: 'Musical' },
          ],
          terms: api.terms.map((term) => ({ ...term, learned: api.learned.has(term.id) })),
        });
        const hold = api.holdNextList;
        api.holdNextList = null;
        if (hold) await hold;
        return answer;
      }
      api.requests.push({ method, path });
      if (api.changeGate) await api.changeGate;
      if (api.failNext) {
        const { status, error } = api.failNext;
        api.failNext = null;
        return json({ error }, status);
      }
      const id = path.split('/')[3];
      if (method === 'PUT') api.learned.add(id);
      else api.learned.delete(id);
      return json(undefined, 204);
    }),
  );
  return api;
}

function openAt(path: string) {
  window.history.replaceState(null, '', path);
  render(<App />);
}

const box = (name: string) => screen.findByRole('checkbox', { name });

test('the main menu leads to the first domain', async () => {
  fakeApi();
  openAt('/');
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Study terms' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Study terms' })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { level: 2, name: /Tannin/ })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/terms/wine');
});

test('an unknown domain in the address goes to the first domain', async () => {
  fakeApi();
  openAt('/terms/no-such-domain');
  expect(await screen.findByRole('heading', { level: 2, name: /Tannin/ })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/terms/wine');
});

test('a domain shows only its own terms, with the original word and meaning', async () => {
  fakeApi();
  openAt('/terms/wine');
  expect(await screen.findByRole('heading', { level: 2, name: /Tannin/ })).toHaveTextContent(
    'Tannin',
  );
  expect(screen.getByText('An astringent compound')).toBeInTheDocument();
  expect(screen.queryByText('Aria')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Opera' }));
  expect(await screen.findByRole('heading', { level: 2, name: /Aria/ })).toBeInTheDocument();
  expect(screen.queryByText('Tannin')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/terms/opera');
});

// #73 fills three domains on the stage and screen; each shows its own terms only.
test.each([
  ['movie', 'Movie', 'Montage'],
  ['opera', 'Opera', 'Aria'],
  ['musical', 'Musical', 'Number'],
])('the %s domain shows its own term', async (key, label, term) => {
  fakeApi();
  openAt('/terms/wine');
  await box('Tannin learned');
  fireEvent.click(screen.getByRole('link', { name: label }));
  expect(
    await screen.findByRole('heading', { level: 2, name: new RegExp(term) }),
  ).toBeInTheDocument();
  const others = ['Tannin', 'Montage', 'Aria', 'Number'].filter((name) => name !== term);
  for (const name of others) {
    expect(
      screen.queryByRole('heading', { level: 2, name: new RegExp(name) }),
    ).not.toBeInTheDocument();
  }
  expect(window.location.pathname).toBe(`/terms/${key}`);
});

test.each([
  ['the term', 'Terroir'],
  ['the original word in any case', 'tERROIR'],
  ['the meaning', 'growing'],
  ['a word with spaces around it', '  Terroir  '],
])('search finds a term by %s', async (_name, search) => {
  fakeApi();
  openAt('/terms/wine');
  await box('Tannin learned');
  fireEvent.change(screen.getByLabelText('Search terms'), { target: { value: search } });
  expect(screen.getByRole('heading', { level: 2, name: /Terroir/ })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { level: 2, name: /Tannin/ })).not.toBeInTheDocument();
});

test('a search without results says so, and another domain starts without the search', async () => {
  fakeApi();
  openAt('/terms/wine');
  await box('Tannin learned');
  // A term of another domain is not a result here.
  fireEvent.change(screen.getByLabelText('Search terms'), { target: { value: 'Aria' } });
  expect(screen.getByText('No results')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Opera' }));
  expect(await screen.findByLabelText('Search terms')).toHaveValue('');
  expect(screen.getByRole('heading', { level: 2, name: /Aria/ })).toBeInTheDocument();
});

test('a learned mark stays after a reload and can be taken back', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  fireEvent.click(await box('Tannin learned'));
  await waitFor(async () => expect(await box('Tannin learned')).toBeChecked());
  expect(api.requests).toEqual([{ method: 'PUT', path: '/api/terms/wine-tannin/learned' }]);
  expect(screen.getByText('Wine · 1/2 terms learned')).toBeInTheDocument();

  cleanup();
  openAt('/terms/wine');
  expect(await box('Tannin learned')).toBeChecked();
  expect(await box('Terroir learned')).not.toBeChecked();

  fireEvent.click(await box('Tannin learned'));
  await waitFor(async () => expect(await box('Tannin learned')).not.toBeChecked());
  expect(api.requests.at(-1)).toEqual({
    method: 'DELETE',
    path: '/api/terms/wine-tannin/learned',
  });
  expect(screen.getByText('Wine · 0/2 terms learned')).toBeInTheDocument();
});

test('a failed mark shows the message and leaves the box as it was', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  const tannin = await box('Tannin learned');
  api.failNext = { status: 500, error: 'A server error occurred' };
  fireEvent.click(tannin);
  expect(await screen.findByRole('alert')).toHaveTextContent('Tannin: A server error occurred');
  expect(tannin).not.toBeChecked();
  fireEvent.click(tannin);
  await waitFor(() => expect(tannin).toBeChecked());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a mark failing after a move to another domain names its term there', async () => {
  const api = fakeApi();
  let open = () => {};
  api.changeGate = new Promise((resolve) => {
    open = resolve;
  });
  api.failNext = { status: 500, error: 'A server error occurred' };
  openAt('/terms/wine');
  fireEvent.click(await box('Tannin learned'));
  fireEvent.click(screen.getByRole('link', { name: 'Opera' }));
  await box('Aria learned');
  await act(async () => {
    open();
    await api.changeGate;
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('Tannin: A server error occurred');
});

test('more clicks during a mark on its way send nothing and keep the keyboard focus', async () => {
  const api = fakeApi();
  let open = () => {};
  api.changeGate = new Promise((resolve) => {
    open = resolve;
  });
  openAt('/terms/wine');
  const tannin = await box('Tannin learned');
  tannin.focus();
  fireEvent.click(tannin);
  fireEvent.click(tannin);
  expect(api.requests).toHaveLength(1);
  expect(tannin).toBeEnabled();
  expect(tannin).toHaveFocus();
  await act(async () => {
    open();
    await api.changeGate;
  });
  await waitFor(() => expect(tannin).toBeChecked());
  expect(api.requests).toHaveLength(1);
});

test('a term gone from the server is reported and leaves the list', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  const tannin = await box('Tannin learned');
  api.failNext = { status: 404, error: 'Term not found' };
  api.terms = api.terms.filter(({ id }) => id !== 'wine-tannin');
  fireEvent.click(tannin);
  expect(await screen.findByRole('alert')).toHaveTextContent('Term not found');
  await waitFor(() => expect(screen.queryByText('Tannin')).not.toBeInTheDocument());
});

test('a mark confirmed during a list on its way keeps both the mark and the refresh', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  const tannin = await box('Tannin learned');
  const terroir = await box('Terroir learned');
  let open = () => {};
  api.holdNextList = new Promise((resolve) => {
    open = resolve;
  });
  api.failNext = { status: 404, error: 'Term not found' };
  api.terms = api.terms.filter(({ id }) => id !== 'wine-tannin');
  fireEvent.click(tannin);
  expect(await screen.findByRole('alert')).toHaveTextContent('Term not found');

  // The held list was read before this mark.
  fireEvent.click(terroir);
  await waitFor(async () => expect(await box('Terroir learned')).toBeChecked());
  await waitFor(() => expect(screen.queryByText('Tannin')).not.toBeInTheDocument());

  await act(async () => {
    open();
    await Promise.resolve();
  });
  expect(await box('Terroir learned')).toBeChecked();
  expect(screen.getByText('Wine · 1/1 terms learned')).toBeInTheDocument();
});

test('a message about a mark goes away on another domain', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  const tannin = await box('Tannin learned');
  api.failNext = { status: 500, error: 'A server error occurred' };
  fireEvent.click(tannin);
  expect(await screen.findByRole('alert')).toHaveTextContent('A server error occurred');
  fireEvent.click(screen.getByRole('link', { name: 'Opera' }));
  await box('Aria learned');
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

test('a failed list can be tried again', async () => {
  const api = fakeApi();
  api.failList = true;
  openAt('/terms/wine');
  expect(await screen.findByText('A server error occurred')).toBeInTheDocument();
  api.failList = false;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { level: 2, name: /Tannin/ })).toBeInTheDocument();
});
