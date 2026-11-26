import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, expect, test, vi } from 'vitest';

import { allowSelect, json, openAt } from './test/app';

type Essay = {
  id: number;
  title: string;
  body: string;
  writtenDate: string;
  status: 'draft' | 'done';
  tags: string[];
};

const TODAY = '2026-11-26';

beforeAll(allowSelect);

// An in-memory essays API. Its essays outlive a render, like the server's do across a reload.
function fakeApi(initial: Essay[] = []) {
  const essays = new Map(initial.map((essay) => [essay.id, essay]));
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  let nextId = 100;
  const words = (body: string) => (body.trim() ? body.trim().split(/\s+/).length : 0);
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init: { method?: string; body?: string } = {}) => {
      const method = init.method ?? 'GET';
      const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
      if (path === '/api/health') return Promise.resolve(json({ today: TODAY }));
      calls.push({ method, path, body });
      if (path === '/api/essays/tags') {
        return Promise.resolve(
          json({ tags: [...new Set([...essays.values()].flatMap((e) => e.tags))] }),
        );
      }
      if (path.startsWith('/api/essays?')) {
        const params = new URLSearchParams(path.split('?')[1]);
        const shown = [...essays.values()].filter(
          (essay) =>
            (!params.get('status') || essay.status === params.get('status')) &&
            (!params.get('tag') || essay.tags.includes(params.get('tag') as string)),
        );
        return Promise.resolve(
          json({
            essays: shown.map(({ body: text, ...rest }) => ({ ...rest, wordCount: words(text) })),
            nextOffset: null,
            total: shown.length,
          }),
        );
      }
      if (path === '/api/essays' && method === 'POST') {
        nextId += 1;
        const essay: Essay = {
          id: nextId,
          title: 'Untitled',
          body: '',
          writtenDate: TODAY,
          status: 'draft',
          tags: [],
          ...body,
        };
        essays.set(essay.id, essay);
        return Promise.resolve(json(essay, 201));
      }
      const one = /^\/api\/essays\/(\d+)$/.exec(path);
      const found = one ? essays.get(Number(one[1])) : undefined;
      if (!found) return Promise.resolve(json({ error: 'Essay not found' }, 404));
      if (method === 'PATCH') {
        const updated = { ...found, ...body };
        essays.set(found.id, updated);
        return Promise.resolve(json(updated));
      }
      if (method === 'DELETE') {
        essays.delete(found.id);
        return Promise.resolve(json(undefined, 204));
      }
      return Promise.resolve(json(found));
    }),
  );
  return { essays, calls };
}

const walking: Essay = {
  id: 1,
  title: 'On walking',
  body: 'Walking is thinking with the legs.',
  writtenDate: '2026-11-20',
  status: 'done',
  tags: ['habits'],
};
const rain: Essay = {
  id: 2,
  title: 'Rain',
  body: '',
  writtenDate: '2026-11-01',
  status: 'draft',
  tags: [],
};

test('the list shows each essay with its date, words, status, and tags, and filters by status', async () => {
  const api = fakeApi([walking, rain]);
  openAt('/essays');
  const list = await screen.findByRole('list', { name: 'Essays' });
  const first = within(list).getAllByRole('listitem')[0];
  expect(first).toHaveTextContent('On walking');
  expect(first).toHaveTextContent('6 words');
  expect(first).toHaveTextContent('Done');
  expect(first).toHaveTextContent('habits');
  expect(within(list).getAllByRole('listitem')).toHaveLength(2);

  fireEvent.click(screen.getByRole('combobox', { name: 'Status' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Draft' }));
  await waitFor(async () =>
    expect(
      within(await screen.findByRole('list', { name: 'Essays' })).getAllByRole('listitem'),
    ).toHaveLength(1),
  );
  expect(api.calls.some((call) => call.path.includes('status=draft'))).toBe(true);
  expect(window.location.search).toBe('?status=draft');
});

test('a new essay starts as an untitled draft and opens in the editor', async () => {
  const api = fakeApi();
  openAt('/essays');
  fireEvent.click(await screen.findByRole('button', { name: 'New essay' }));
  await waitFor(() => expect(window.location.pathname).toBe('/essays/101'));
  expect(await screen.findByLabelText('Title')).toHaveValue('Untitled');
  expect(api.essays.get(101)?.status).toBe('draft');
});

test('typing saves the draft by itself after a few seconds, and a reload shows it', async () => {
  const api = fakeApi([rain]);
  vi.useFakeTimers({ shouldAdvanceTime: true });
  openAt('/essays/2');
  const text = await screen.findByLabelText(/^Text/);
  fireEvent.change(text, { target: { value: 'It rained all day.' } });
  expect(screen.getByText(/^Unsaved changes/)).toBeInTheDocument();
  expect(api.calls.some((call) => call.method === 'PATCH')).toBe(false);
  act(() => {
    vi.advanceTimersByTime(3100);
  });
  await waitFor(() => expect(api.essays.get(2)?.body).toBe('It rained all day.'));
  await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument());
  expect(screen.getByText('4 words')).toBeInTheDocument();

  cleanup();
  openAt('/essays/2');
  expect(await screen.findByLabelText(/^Text/)).toHaveValue('It rained all day.');
});

test('leaving the editor saves what was typed', async () => {
  const api = fakeApi([rain]);
  openAt('/essays/2');
  fireEvent.change(await screen.findByLabelText(/^Text/), { target: { value: 'Quick note' } });
  fireEvent.click(screen.getByRole('link', { name: 'All essays' }));
  await waitFor(() => expect(api.essays.get(2)?.body).toBe('Quick note'));
});

test('the preview shows the Markdown, and tags are picked from the used ones or added', async () => {
  const api = fakeApi([walking]);
  openAt('/essays/1');
  const text = await screen.findByLabelText(/^Text/);
  fireEvent.change(text, { target: { value: '# Heading\n\nSome **bold** words' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Preview' }));
  const preview = screen.getByRole('region', { name: 'Preview' });
  expect(within(preview).getByRole('heading', { name: 'Heading' })).toBeInTheDocument();
  expect(within(preview).getByText('bold').tagName).toBe('STRONG');
  fireEvent.click(screen.getByRole('radio', { name: 'Write' }));

  // Add a new tag, then save now.
  const tag = screen.getByLabelText('Tags');
  fireEvent.change(tag, { target: { value: 'Walks' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
  expect(
    within(screen.getByRole('list', { name: 'Added tags' })).getByText('Walks'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save now' }));
  await waitFor(() => expect(api.essays.get(1)?.tags).toEqual(['habits', 'Walks']));
  expect(api.essays.get(1)?.body).toBe('# Heading\n\nSome **bold** words');
});

test('deleting an essay asks first and goes back to the list', async () => {
  const api = fakeApi([walking, rain]);
  openAt('/essays/1');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('On walking');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(window.location.pathname).toBe('/essays'));
  expect(api.essays.has(1)).toBe(false);
  const list = await screen.findByRole('list', { name: 'Essays' });
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
});

test('an essay that does not exist says so', async () => {
  fakeApi();
  openAt('/essays/999');
  expect(await screen.findByText(/This essay does not exist/)).toBeInTheDocument();
});
