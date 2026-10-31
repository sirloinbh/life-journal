import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';

import { App } from './app';
import type { Item } from './items';

const TODAY = '2026-10-31';

// jsdom has none of these; the Select component needs them.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-31T03:00:00Z'));
});

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

// An in-memory API with the rules the screen depends on. `failNext` answers the next change with an
// error, and a `gate` holds requests until it resolves.
function fakeApi(initial: Partial<Item>[] = []) {
  let nextId = 1;
  const row = (fields: Partial<Item>): Item => ({
    id: nextId++,
    category: 'reading',
    subtype: null,
    title: '',
    status: 'wishlist',
    costKrw: null,
    plannedDate: null,
    completedDate: null,
    details: {},
    ...fields,
  });
  const api = {
    items: initial.map(row),
    requests: [] as { method: string; path: string; body: Record<string, unknown> }[],
    failNext: null as { status: number; error: string } | null,
    failList: false,
    gate: null as Promise<void> | null,
    listGate: null as Promise<void> | null,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: { method?: string; body?: string } = {}) => {
      const method = init.method ?? 'GET';
      if (path === '/api/health') return json({ today: TODAY });
      if (api.gate) await api.gate;
      if (method === 'GET') {
        // A held list answers with what was true when it was asked.
        const items = api.items;
        if (api.listGate) {
          await api.listGate;
          return json({ items });
        }
        return api.failList
          ? json({ error: '서버 오류가 발생했습니다' }, 500)
          : json({ items: api.items });
      }
      const body = (init.body ? JSON.parse(init.body) : {}) as Record<string, unknown>;
      api.requests.push({ method, path, body });
      if (api.failNext) {
        const { status, error } = api.failNext;
        api.failNext = null;
        return json({ error }, status);
      }
      if (body.title === '') return json({ error: '제목을(를) 입력해 주세요' }, 400);
      if (method === 'POST') {
        const created = row(body);
        api.items.push(created);
        return json(created, 201);
      }
      const id = Number(path.split('/').pop());
      if (method === 'DELETE') {
        api.items = api.items.filter((item) => item.id !== id);
        return json(undefined, 204);
      }
      api.items = api.items.map((item) => (item.id === id ? { ...item, ...body } : item));
      return json(api.items.find((item) => item.id === id));
    }),
  );
  return api;
}

function gate() {
  let open = () => {};
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

function openAt(path: string) {
  window.history.replaceState(null, '', path);
  render(<App />);
}

const openDialog = async (buttonName: string) => {
  fireEvent.click(await screen.findByRole('button', { name: buttonName }));
  return within(await screen.findByRole('dialog'));
};

const dialogClosed = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

const type = (dialog: ReturnType<typeof within>, label: string, value: string) =>
  fireEvent.change(dialog.getByLabelText(label), { target: { value } });

const pressEscape = () =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

async function choose(dialog: ReturnType<typeof within>, label: string, option: string) {
  fireEvent.click(dialog.getByRole('combobox', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

const cases = [
  { tab: '독서', key: 'reading', field: '저자 (선택)', detail: { author: '헤세' } },
  {
    tab: '영화·드라마',
    key: 'screen',
    subtype: ['영화', 'movie'],
    field: '감독 (선택)',
    detail: { director: '헤세' },
  },
  {
    tab: '공연',
    key: 'stage',
    subtype: ['오페라', 'opera'],
    field: '공연장 (선택)',
    detail: { venue: '헤세' },
  },
  {
    tab: '주류',
    key: 'drink',
    subtype: ['와인', 'wine'],
    field: '생산자 (선택)',
    detail: { producer: '헤세' },
  },
  { tab: '여행', key: 'travel', field: '도시 (선택)', detail: { city: '헤세' } },
] as const;

for (const { tab, key, field, detail, ...rest } of cases) {
  const subtype = 'subtype' in rest ? rest.subtype : undefined;

  test(`${tab}: an item is added, edited, marked done, reopened, and deleted`, async () => {
    const api = fakeApi();
    openAt('/bucket-list');
    const tabs = await screen.findByRole('navigation', { name: '분야' });
    fireEvent.click(within(tabs).getByRole('link', { name: tab }));
    expect(window.location.pathname).toBe(`/bucket-list/${key}`);

    let dialog = await openDialog('항목 추가');
    type(dialog, '제목', '  첫 항목  ');
    type(dialog, field, '헤세');
    type(dialog, '비용(원, 선택)', '15,000');
    type(dialog, '예정일 (선택)', '2027-03-01');
    if (subtype) await choose(dialog, '세부 종류', subtype[0]);
    fireEvent.click(dialog.getByRole('button', { name: '저장' }));
    await dialogClosed();
    expect(api.requests.at(-1)).toEqual({
      method: 'POST',
      path: '/api/items',
      body: {
        category: key,
        title: '첫 항목',
        subtype: subtype ? subtype[1] : null,
        costKrw: 15000,
        plannedDate: '2027-03-01',
        details: detail,
      },
    });
    expect(await screen.findByText('첫 항목')).toBeInTheDocument();
    expect(screen.getByText(/비용 15,000원 · 예정일 2027-03-01/)).toBeInTheDocument();

    dialog = await openDialog('첫 항목 수정');
    expect(dialog.getByLabelText('제목')).toHaveValue('첫 항목');
    expect(dialog.getByLabelText(field)).toHaveValue('헤세');
    type(dialog, '제목', '고친 항목');
    type(dialog, '비용(원, 선택)', '');
    fireEvent.click(dialog.getByRole('button', { name: '저장' }));
    await dialogClosed();
    expect(api.requests.at(-1)?.method).toBe('PATCH');
    expect(api.requests.at(-1)?.body).toMatchObject({ title: '고친 항목', costKrw: null });

    dialog = await openDialog('고친 항목 완료 표시');
    expect(dialog.getByLabelText('완료일')).toHaveValue(TODAY);
    fireEvent.click(dialog.getByRole('button', { name: '완료로 표시' }));
    await dialogClosed();
    expect(api.requests.at(-1)?.body).toEqual({ status: 'done', completedDate: TODAY });
    expect(await screen.findByText(new RegExp(`완료일 ${TODAY}`))).toBeInTheDocument();

    dialog = await openDialog('고친 항목 완료 취소');
    fireEvent.click(dialog.getByRole('button', { name: '완료 취소' }));
    await dialogClosed();
    expect(api.requests.at(-1)?.body).toEqual({ status: 'wishlist', completedDate: null });

    dialog = await openDialog('고친 항목 삭제');
    fireEvent.click(dialog.getByRole('button', { name: '삭제' }));
    await dialogClosed();
    expect(api.requests.at(-1)?.method).toBe('DELETE');
    expect(await screen.findByText(`${tab} 항목이 없습니다`)).toBeInTheDocument();
  });
}

test('each tab shows only the items of its category', async () => {
  fakeApi([
    { category: 'reading', title: '데미안' },
    { category: 'travel', title: '교토' },
  ]);
  openAt('/bucket-list/reading');
  expect(await screen.findByText('데미안')).toBeInTheDocument();
  expect(screen.queryByText('교토')).toBeNull();
  const tabs = screen.getByRole('navigation', { name: '분야' });
  expect(within(tabs).getByRole('link', { name: '독서' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(within(tabs).getByRole('link', { name: '여행' }));
  expect(await screen.findByText('교토')).toBeInTheDocument();
  expect(screen.queryByText('데미안')).toBeNull();
});

test('the main menu link opens the first category', async () => {
  fakeApi();
  openAt('/');
  const menu = screen.getByRole('navigation', { name: '주 메뉴' });
  fireEvent.click(within(menu).getByRole('link', { name: '버킷리스트' }));
  expect(await screen.findByRole('heading', { level: 1, name: '버킷리스트' })).toBeInTheDocument();
  await waitFor(() => expect(window.location.pathname).toBe('/bucket-list/reading'));
  expect(within(menu).getByRole('link', { name: '버킷리스트' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('an unknown category address falls back to the first category', async () => {
  fakeApi();
  openAt('/bucket-list/no-such-category');
  await waitFor(() => expect(window.location.pathname).toBe('/bucket-list/reading'));
  expect(await screen.findByText('독서 항목이 없습니다')).toBeInTheDocument();
});

test('item titles follow the page heading order', async () => {
  fakeApi([{ title: '데미안' }]);
  openAt('/bucket-list/reading');
  expect(await screen.findByRole('heading', { level: 2, name: /데미안/ })).toBeInTheDocument();
});

test('a server validation error stays in the open form in Korean', async () => {
  const api = fakeApi();
  openAt('/bucket-list/reading');
  const dialog = await openDialog('항목 추가');
  type(dialog, '저자 (선택)', '헤세');
  fireEvent.click(dialog.getByRole('button', { name: '저장' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent('제목을(를) 입력해 주세요');
  expect(dialog.getByLabelText('저자 (선택)')).toHaveValue('헤세');
  expect(dialog.getByRole('button', { name: '저장' })).toBeEnabled();
  expect(api.items).toHaveLength(0);
});

test('every drink field is sent, and the vintage as a number', async () => {
  const api = fakeApi();
  openAt('/bucket-list/drink');
  const dialog = await openDialog('항목 추가');
  type(dialog, '제목', '샤블리');
  await choose(dialog, '세부 종류', '와인');
  type(dialog, '생산자 (선택)', '도멘');
  type(dialog, '산지 (선택)', '부르고뉴');
  type(dialog, '빈티지 (선택)', '2019');
  fireEvent.click(dialog.getByRole('button', { name: '저장' }));
  await dialogClosed();
  expect(api.requests.at(-1)?.body.details).toEqual({
    producer: '도멘',
    region: '부르고뉴',
    vintage: 2019,
  });
});

for (const text of ['비쌈', '15.000', '1e3', '1,5']) {
  test(`a cost of ${text} is left for the server to explain`, async () => {
    const api = fakeApi();
    api.failNext = { status: 400, error: '비용은 0원 이상의 정수로 입력해 주세요' };
    openAt('/bucket-list/reading');
    const dialog = await openDialog('항목 추가');
    type(dialog, '제목', '데미안');
    type(dialog, '비용(원, 선택)', text);
    fireEvent.click(dialog.getByRole('button', { name: '저장' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      '비용은 0원 이상의 정수로 입력해 주세요',
    );
    expect(api.requests.at(-1)?.body.costKrw).toBe(text);
  });
}

test('the completed date defaults to today in Asia/Seoul, not UTC', async () => {
  vi.setSystemTime(new Date('2026-10-31T15:00:00Z'));
  fakeApi([{ title: '데미안' }]);
  openAt('/bucket-list/reading');
  const dialog = await openDialog('데미안 완료 표시');
  expect(dialog.getByLabelText('완료일')).toHaveValue('2026-11-01');
});

test('a rejected completed date stays in the completion dialog', async () => {
  const api = fakeApi([{ title: '데미안' }]);
  api.failNext = { status: 400, error: '완료일은 오늘보다 뒤일 수 없습니다' };
  openAt('/bucket-list/reading');
  const dialog = await openDialog('데미안 완료 표시');
  type(dialog, '완료일', '2027-01-01');
  fireEvent.click(dialog.getByRole('button', { name: '완료로 표시' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent('완료일은 오늘보다 뒤일 수 없습니다');
});

test('a done item edits its completed date in the form', async () => {
  const api = fakeApi([{ title: '데미안', status: 'done', completedDate: '2026-10-01' }]);
  openAt('/bucket-list/reading');
  const dialog = await openDialog('데미안 수정');
  expect(dialog.getByLabelText('완료일')).toHaveValue('2026-10-01');
  type(dialog, '완료일', '2026-10-02');
  fireEvent.click(dialog.getByRole('button', { name: '저장' }));
  await dialogClosed();
  expect(api.requests.at(-1)?.body.completedDate).toBe('2026-10-02');
});

test('the form cannot close while saving, so a failure is still shown', async () => {
  const api = fakeApi();
  const held = gate();
  openAt('/bucket-list/reading');
  const dialog = await openDialog('항목 추가');
  type(dialog, '제목', '데미안');
  api.gate = held.promise;
  api.failNext = { status: 500, error: '서버 오류가 발생했습니다' };
  fireEvent.click(dialog.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(dialog.getByRole('button', { name: /저장/ })).toBeDisabled());
  pressEscape();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  api.gate = null;
  held.open();
  expect(await dialog.findByRole('alert')).toHaveTextContent('서버 오류가 발생했습니다');
  pressEscape();
  await dialogClosed();
});

test('changes show the server response even when the reload after them fails', async () => {
  const api = fakeApi([{ title: '데미안', costKrw: 1000 }]);
  openAt('/bucket-list/reading');
  await screen.findByText('데미안');
  api.failList = true;

  let dialog = await openDialog('항목 추가');
  type(dialog, '제목', '수레바퀴');
  fireEvent.click(dialog.getByRole('button', { name: '저장' }));
  await dialogClosed();
  expect(await screen.findByText('수레바퀴')).toBeInTheDocument();
  expect(screen.getByText('저장했습니다')).toHaveAttribute('role', 'status');
  expect(screen.queryByRole('alert')).toBeNull();

  // The next edit starts from the saved values, so it cannot bring old ones back.
  dialog = await openDialog('데미안 수정');
  type(dialog, '제목', '고친 제목');
  fireEvent.click(dialog.getByRole('button', { name: '저장' }));
  await dialogClosed();
  dialog = await openDialog('고친 제목 수정');
  expect(dialog.getByLabelText('제목')).toHaveValue('고친 제목');
  fireEvent.click(dialog.getByRole('button', { name: '취소' }));
  await dialogClosed();

  dialog = await openDialog('고친 제목 완료 표시');
  fireEvent.click(dialog.getByRole('button', { name: '완료로 표시' }));
  await dialogClosed();
  dialog = await openDialog('고친 제목 완료 취소');
  fireEvent.click(dialog.getByRole('button', { name: '완료 취소' }));
  await dialogClosed();
  expect(await screen.findByRole('button', { name: '고친 제목 완료 표시' })).toBeInTheDocument();

  dialog = await openDialog('고친 제목 삭제');
  fireEvent.click(dialog.getByRole('button', { name: '삭제' }));
  await dialogClosed();
  await waitFor(() => expect(screen.queryByText('고친 제목')).toBeNull());
  expect(screen.getByText('수레바퀴')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('a slow older list response cannot replace a newer one', async () => {
  const api = fakeApi([{ title: '데미안' }]);
  openAt('/bucket-list/reading');
  const dialog = await openDialog('데미안 수정');

  // The 404 starts a reload that answers with the old list, late.
  const held = gate();
  api.listGate = held.promise;
  api.failNext = { status: 404, error: '항목을 찾을 수 없습니다' };
  fireEvent.click(dialog.getByRole('button', { name: '저장' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent('항목을 찾을 수 없습니다');

  api.listGate = null;
  type(dialog, '제목', '고친 제목');
  fireEvent.click(dialog.getByRole('button', { name: '저장' }));
  await dialogClosed();
  expect(await screen.findByText('고친 제목')).toBeInTheDocument();

  await act(async () => {
    held.open();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(screen.getByText('고친 제목')).toBeInTheDocument();
  expect(screen.queryByText('데미안')).toBeNull();
});

test('editing an item that is already gone reports it and refreshes the list', async () => {
  const api = fakeApi([{ title: '데미안' }]);
  openAt('/bucket-list/reading');
  const dialog = await openDialog('데미안 수정');
  api.items = [];
  api.failNext = { status: 404, error: '항목을 찾을 수 없습니다' };
  fireEvent.click(dialog.getByRole('button', { name: '저장' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent('항목을 찾을 수 없습니다');
  fireEvent.click(dialog.getByRole('button', { name: '취소' }));
  await dialogClosed();
  expect(await screen.findByText('독서 항목이 없습니다')).toBeInTheDocument();
});

test('deleting an item that is already gone reports it and refreshes the list', async () => {
  const api = fakeApi([{ title: '데미안' }]);
  openAt('/bucket-list/reading');
  const dialog = await openDialog('데미안 삭제');
  api.items = [];
  api.failNext = { status: 404, error: '항목을 찾을 수 없습니다' };
  fireEvent.click(dialog.getByRole('button', { name: '삭제' }));
  await dialogClosed();
  expect(await screen.findByText('항목을 찾을 수 없습니다')).toHaveAttribute('role', 'alert');
  expect(await screen.findByText('독서 항목이 없습니다')).toBeInTheDocument();
});

test('a failed list load is reported, and the retry button waits for its request', async () => {
  const api = fakeApi([{ title: '데미안' }]);
  api.failList = true;
  openAt('/bucket-list/reading');
  expect(await screen.findByText('서버 오류가 발생했습니다')).toHaveAttribute('role', 'alert');
  const held = gate();
  api.gate = held.promise;
  api.failList = false;
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(screen.getByRole('button', { name: /다시 시도/ })).toBeDisabled();
  api.gate = null;
  held.open();
  expect(await screen.findByText('데미안')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});

for (const name of ['항목 추가', '데미안 수정', '데미안 완료 표시', '데미안 삭제']) {
  test(`closing the dialog of "${name}" returns focus to its button`, async () => {
    fakeApi([{ title: '데미안' }]);
    openAt('/bucket-list/reading');
    const button = await screen.findByRole('button', { name });
    button.focus();
    fireEvent.click(button);
    await screen.findByRole('dialog');
    pressEscape();
    await dialogClosed();
    await waitFor(() => expect(document.activeElement).toBe(button));
  });
}
