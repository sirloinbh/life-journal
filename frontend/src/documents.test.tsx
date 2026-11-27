import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { json, openAt } from './test/app';

const doc = (id: number, title: string, parent: number | null, extra: object = {}) => ({
  id,
  notionId: `n${id}`,
  parentNotionId: parent === null ? null : `n${parent}`,
  kind: 'page',
  title,
  path: title,
  notionEditedAt: '2026-11-20T10:00:00.000Z',
  importedAt: '2026-11-27T01:00:00.000Z',
  deletedAt: null,
  ...extra,
});

const tree = [
  doc(1, 'Travel', null),
  doc(2, 'Japan', 1),
  doc(3, 'Reading list', 1, { kind: 'database' }),
  doc(4, 'Dune', 3, { deletedAt: '2026-11-26T00:00:00.000Z' }),
  doc(5, 'Notes', null),
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stub(handler: (path: string, method: string) => Response | undefined) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init: { method?: string } = {}) => {
      const method = init.method ?? 'GET';
      if (path === '/api/health') return Promise.resolve(json({ today: '2026-11-27' }));
      calls.push(`${method} ${path}`);
      return Promise.resolve(handler(path, method) ?? json({ error: 'Not found' }, 404));
    }),
  );
  return calls;
}

test('the Documents page shows the Notion tree, marks databases and removed pages, and links each page', async () => {
  stub((path) => (path === '/api/documents' ? json({ documents: tree }) : undefined));
  openAt('/documents');
  const nav = await screen.findByRole('navigation', { name: 'Documents' });
  const top = within(nav).getAllByRole('list')[0];
  const roots = Array.from(top.children).map((li) => li.querySelector('a')?.textContent);
  expect(roots).toEqual(['Notes', 'Travel']);
  const travel = within(nav).getByRole('link', { name: 'Travel' }).closest('li') as HTMLElement;
  expect(
    within(travel)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Travel', 'Japan', 'Reading list', 'Dune']);
  expect(within(travel).getByText('Database')).toBeInTheDocument();
  expect(within(travel).getByText('Removed from Notion')).toBeInTheDocument();
  expect(within(nav).getByRole('link', { name: 'Japan' })).toHaveAttribute('href', '/documents/2');
});

test('an empty Documents page points to Settings', async () => {
  stub((path) => (path === '/api/documents' ? json({ documents: [] }) : undefined));
  openAt('/documents');
  expect(await screen.findByText('No documents yet')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to Settings to import' })).toHaveAttribute(
    'href',
    '/settings',
  );
});

test('a failed load shows the message and Try again reloads', async () => {
  let fail = true;
  stub((path) =>
    path === '/api/documents'
      ? fail
        ? json({ error: 'Cannot read the documents' }, 500)
        : json({ documents: tree })
      : undefined,
  );
  openAt('/documents');
  expect(await screen.findByText('Cannot read the documents')).toBeInTheDocument();
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('link', { name: 'Japan' })).toBeInTheDocument();
});

test('a page shows its Markdown, and "Copy into an essay" opens the new draft', async () => {
  const calls = stub((path, method) => {
    if (path === '/api/documents/2')
      return json({
        ...doc(2, 'Japan', 1),
        path: 'Travel / Japan',
        body: '# Japan 2027\n\n- Tokyo',
      });
    if (path === '/api/documents/2/essay' && method === 'POST') return json({ id: 77 }, 201);
    if (path === '/api/essays/77')
      return json({
        id: 77,
        title: 'Japan',
        body: '# Japan 2027',
        writtenDate: '2026-11-27',
        status: 'draft',
        tags: [],
      });
    if (path === '/api/essays/tags') return json({ tags: [] });
    return undefined;
  });
  openAt('/documents/2');
  expect(await screen.findByRole('heading', { name: 'Japan' })).toBeInTheDocument();
  expect(screen.getByText('Travel / Japan')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Japan 2027' })).toBeInTheDocument();
  expect(screen.getByText('Tokyo')).toBeInTheDocument();
  expect(screen.getByText(/Edited in Notion November 20, 2026/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Copy into an essay' }));
  await waitFor(() => expect(window.location.pathname).toBe('/essays/77'));
  expect(calls).toContain('POST /api/documents/2/essay');
});

test('a copy that the server refuses shows its message and stays on the page', async () => {
  stub((path, method) => {
    if (path === '/api/documents/2') return json({ ...doc(2, 'Japan', 1), body: 'text' });
    if (method === 'POST')
      return json({ error: 'This page is longer than an essay can be (50,000 characters)' }, 400);
    return undefined;
  });
  openAt('/documents/2');
  fireEvent.click(await screen.findByRole('button', { name: 'Copy into an essay' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('longer than an essay can be');
  expect(window.location.pathname).toBe('/documents/2');
});

test('a missing page shows the server message with a way back', async () => {
  stub((path) =>
    path === '/api/documents/9' ? json({ error: 'Document not found' }, 404) : undefined,
  );
  openAt('/documents/9');
  expect(await screen.findByText('Document not found')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'All documents' })).toHaveAttribute('href', '/documents');
});

const status = (over: object = {}) => ({
  configured: true,
  state: 'idle',
  startedAt: null,
  finishedAt: null,
  seen: 0,
  created: 0,
  updated: 0,
  unchanged: 0,
  deleted: 0,
  current: null,
  error: null,
  ...over,
});

test('Settings starts the import, shows progress while it runs, then the result', async () => {
  let reads = 0;
  let started = false;
  const calls = stub((path, method) => {
    if (path === '/api/notion/import' && method === 'POST') {
      started = true;
      return json(status({ state: 'running' }), 202);
    }
    if (path === '/api/notion/import') {
      if (!started) return json(status());
      reads += 1;
      return reads < 3
        ? json(status({ state: 'running', seen: 4, current: 'Japan' }))
        : json(
            status({ state: 'done', seen: 7, created: 5, updated: 1, unchanged: 1, deleted: 0 }),
          );
    }
    if (path === '/api/documents') return json({ documents: tree });
    return undefined;
  });
  openAt('/settings');
  const button = await screen.findByRole('button', { name: 'Import from Notion' });
  fireEvent.click(button);
  expect(await screen.findByText(/4 pages read so far; now Japan/)).toBeInTheDocument();
  // A second click while it runs starts nothing.
  fireEvent.click(screen.getByRole('button', { name: /Importing/ }));
  expect(calls.filter((c) => c === 'POST /api/notion/import')).toHaveLength(1);
  expect(
    await screen.findByText(
      /Imported 7 pages: 5 new, 1 updated, 1 unchanged, 0 removed from Notion/,
      {},
      { timeout: 6000 },
    ),
  ).toBeInTheDocument();
}, 10_000);

test('Settings says the import is off without a token, and shows a failed run', async () => {
  stub((path) => (path === '/api/notion/import' ? json(status({ configured: false })) : undefined));
  openAt('/settings');
  expect(await screen.findByText(/Notion token is not set/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import from Notion' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  cleanup();
  stub((path) =>
    path === '/api/notion/import'
      ? json(status({ state: 'failed', seen: 3, error: 'Notion rejected the token' }))
      : undefined,
  );
  openAt('/settings');
  expect(
    await screen.findByText('The import stopped after 3 pages: Notion rejected the token'),
  ).toBeInTheDocument();
});
