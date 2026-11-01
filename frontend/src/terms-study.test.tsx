import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

const TERMS = [
  { id: 'wine-tannin', domain: 'wine', term: '타닌', original: 'Tannin', meaning: '떫은 성분' },
  { id: 'wine-terroir', domain: 'wine', term: '테루아', original: 'Terroir', meaning: '자란 환경' },
  { id: 'opera-aria', domain: 'opera', term: '아리아', original: 'Aria', meaning: '독창곡' },
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
        if (api.failList) return json({ error: '서버 오류가 발생했습니다' }, 500);
        // A held list answers with what was true when it was asked.
        const answer = json({
          domains: [
            { key: 'wine', label: '와인' },
            { key: 'opera', label: '오페라' },
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
  const menu = screen.getByRole('navigation', { name: '주 메뉴' });
  fireEvent.click(within(menu).getByRole('link', { name: '용어 공부' }));
  expect(await screen.findByRole('heading', { level: 1, name: '용어 공부' })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { level: 2, name: /타닌/ })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/terms/wine');
});

test('an unknown domain in the address goes to the first domain', async () => {
  fakeApi();
  openAt('/terms/no-such-domain');
  expect(await screen.findByRole('heading', { level: 2, name: /타닌/ })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/terms/wine');
});

test('a domain shows only its own terms, with the original word and meaning', async () => {
  fakeApi();
  openAt('/terms/wine');
  expect(await screen.findByRole('heading', { level: 2, name: /타닌/ })).toHaveTextContent(
    'Tannin',
  );
  expect(screen.getByText('떫은 성분')).toBeInTheDocument();
  expect(screen.queryByText('아리아')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: '오페라' }));
  expect(await screen.findByRole('heading', { level: 2, name: /아리아/ })).toBeInTheDocument();
  expect(screen.queryByText('타닌')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/terms/opera');
});

test.each([
  ['the term', '테루아'],
  ['the original word in any case', 'tERROIR'],
  ['the meaning', '자란'],
  ['a word with spaces around it', '  테루아  '],
])('search finds a term by %s', async (_name, search) => {
  fakeApi();
  openAt('/terms/wine');
  await box('타닌 외움');
  fireEvent.change(screen.getByLabelText('용어 검색'), { target: { value: search } });
  expect(screen.getByRole('heading', { level: 2, name: /테루아/ })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { level: 2, name: /타닌/ })).not.toBeInTheDocument();
});

test('a search without results says so, and another domain starts without the search', async () => {
  fakeApi();
  openAt('/terms/wine');
  await box('타닌 외움');
  // A term of another domain is not a result here.
  fireEvent.change(screen.getByLabelText('용어 검색'), { target: { value: '아리아' } });
  expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: '오페라' }));
  expect(await screen.findByLabelText('용어 검색')).toHaveValue('');
  expect(screen.getByRole('heading', { level: 2, name: /아리아/ })).toBeInTheDocument();
});

test('a learned mark stays after a reload and can be taken back', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  fireEvent.click(await box('타닌 외움'));
  await waitFor(async () => expect(await box('타닌 외움')).toBeChecked());
  expect(api.requests).toEqual([{ method: 'PUT', path: '/api/terms/wine-tannin/learned' }]);
  expect(screen.getByText('와인 · 외운 용어 1/2개')).toBeInTheDocument();

  cleanup();
  openAt('/terms/wine');
  expect(await box('타닌 외움')).toBeChecked();
  expect(await box('테루아 외움')).not.toBeChecked();

  fireEvent.click(await box('타닌 외움'));
  await waitFor(async () => expect(await box('타닌 외움')).not.toBeChecked());
  expect(api.requests.at(-1)).toEqual({
    method: 'DELETE',
    path: '/api/terms/wine-tannin/learned',
  });
  expect(screen.getByText('와인 · 외운 용어 0/2개')).toBeInTheDocument();
});

test('a failed mark shows the message and leaves the box as it was', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  const tannin = await box('타닌 외움');
  api.failNext = { status: 500, error: '서버 오류가 발생했습니다' };
  fireEvent.click(tannin);
  expect(await screen.findByRole('alert')).toHaveTextContent('타닌: 서버 오류가 발생했습니다');
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
  api.failNext = { status: 500, error: '서버 오류가 발생했습니다' };
  openAt('/terms/wine');
  fireEvent.click(await box('타닌 외움'));
  fireEvent.click(screen.getByRole('link', { name: '오페라' }));
  await box('아리아 외움');
  await act(async () => {
    open();
    await api.changeGate;
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('타닌: 서버 오류가 발생했습니다');
});

test('more clicks during a mark on its way send nothing and keep the keyboard focus', async () => {
  const api = fakeApi();
  let open = () => {};
  api.changeGate = new Promise((resolve) => {
    open = resolve;
  });
  openAt('/terms/wine');
  const tannin = await box('타닌 외움');
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
  const tannin = await box('타닌 외움');
  api.failNext = { status: 404, error: '용어를 찾을 수 없습니다' };
  api.terms = api.terms.filter(({ id }) => id !== 'wine-tannin');
  fireEvent.click(tannin);
  expect(await screen.findByRole('alert')).toHaveTextContent('용어를 찾을 수 없습니다');
  await waitFor(() => expect(screen.queryByText('타닌')).not.toBeInTheDocument());
});

test('a mark confirmed during a list on its way keeps both the mark and the refresh', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  const tannin = await box('타닌 외움');
  const terroir = await box('테루아 외움');
  let open = () => {};
  api.holdNextList = new Promise((resolve) => {
    open = resolve;
  });
  api.failNext = { status: 404, error: '용어를 찾을 수 없습니다' };
  api.terms = api.terms.filter(({ id }) => id !== 'wine-tannin');
  fireEvent.click(tannin);
  expect(await screen.findByRole('alert')).toHaveTextContent('용어를 찾을 수 없습니다');

  // The held list was read before this mark.
  fireEvent.click(terroir);
  await waitFor(async () => expect(await box('테루아 외움')).toBeChecked());
  await waitFor(() => expect(screen.queryByText('타닌')).not.toBeInTheDocument());

  await act(async () => {
    open();
    await Promise.resolve();
  });
  expect(await box('테루아 외움')).toBeChecked();
  expect(screen.getByText('와인 · 외운 용어 1/1개')).toBeInTheDocument();
});

test('a message about a mark goes away on another domain', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  const tannin = await box('타닌 외움');
  api.failNext = { status: 500, error: '서버 오류가 발생했습니다' };
  fireEvent.click(tannin);
  expect(await screen.findByRole('alert')).toHaveTextContent('서버 오류가 발생했습니다');
  fireEvent.click(screen.getByRole('link', { name: '오페라' }));
  await box('아리아 외움');
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

test('a failed list can be tried again', async () => {
  const api = fakeApi();
  api.failList = true;
  openAt('/terms/wine');
  expect(await screen.findByText('서버 오류가 발생했습니다')).toBeInTheDocument();
  api.failList = false;
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByRole('heading', { level: 2, name: /타닌/ })).toBeInTheDocument();
});
