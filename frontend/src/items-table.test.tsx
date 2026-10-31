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
  title: `항목 ${id}`,
  status: 'wishlist',
  costKrw: null,
  plannedDate: null,
  completedDate: null,
  details: {},
  rating: null,
  subRatings: {},
  review: null,
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

const rows = () => within(screen.getByRole('region', { name: '항목 표' })).getAllByRole('row');

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
  const menu = screen.getByRole('navigation', { name: '주 메뉴' });
  fireEvent.click(within(menu).getByRole('link', { name: '표 보기' }));
  expect(await screen.findByRole('link', { name: '라 보엠' })).toHaveAttribute(
    'href',
    '/bucket-list/stage',
  );
  const cells = within(rows()[1])
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
  expect(cells).toEqual([
    '라 보엠',
    '공연',
    '완료',
    '150,000원',
    '2026-09-01',
    '2026-09-02',
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
  await screen.findByRole('link', { name: '항목 1' });
  await choose('분야', '여행');
  expect(await screen.findByRole('link', { name: '교토' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '항목 1' })).toBeNull();
  expect(asked.at(-1)).toBe('category=travel');
  expect(window.location.search).toBe('?category=travel');

  await choose('분야', '전체');
  await screen.findByRole('link', { name: '항목 1' });
  expect(window.location.search).toBe('');
});

test('filters in the address are used, shown, and kept', async () => {
  const search =
    'q=%ED%97%A4%EC%84%B8&status=done&from=2026-01-01&to=2026-12-31&costMin=1000&costMax=2000';
  const asked = fakeApi(() => json({ items: [] }));
  openAt(`/table?${search}`);
  expect(await screen.findByText('조건에 맞는 항목이 없습니다')).toBeInTheDocument();
  expect(asked).toEqual([search]);
  expect(screen.getByLabelText('검색(제목, 분야별 정보)')).toHaveValue('헤세');
  expect(screen.getByRole('combobox', { name: '상태' })).toHaveTextContent('완료');
  expect(screen.getByLabelText('기간 시작(완료일, 없으면 예정일)')).toHaveValue('2026-01-01');
  expect(screen.getByLabelText('기간 끝')).toHaveValue('2026-12-31');
  expect(screen.getByLabelText('최소 비용(원)')).toHaveValue('1000');
  expect(screen.getByLabelText('최대 비용(원)')).toHaveValue('2000');
});

test('text filters apply on Enter or leaving the field, not while typing', async () => {
  const asked = fakeApi(() => json({ items: [] }));
  openAt('/table');
  await screen.findByText('조건에 맞는 항목이 없습니다');
  const field = screen.getByLabelText('검색(제목, 분야별 정보)');
  fireEvent.change(field, { target: { value: ' 헤세 ' } });
  expect(asked).toEqual(['']);
  fireEvent.keyDown(field, { key: 'Enter' });
  await waitFor(() => expect(window.location.search).toBe('?q=%ED%97%A4%EC%84%B8'));

  const cost = screen.getByLabelText('최소 비용(원)');
  fireEvent.change(cost, { target: { value: '1000' } });
  fireEvent.blur(cost);
  await waitFor(() =>
    expect(new URLSearchParams(window.location.search).get('costMin')).toBe('1000'),
  );
  await waitFor(() => expect(asked.at(-1)).toContain('costMin=1000'));
});

test('date filters apply when they change', async () => {
  const asked = fakeApi(() => json({ items: [] }));
  openAt('/table');
  await screen.findByText('조건에 맞는 항목이 없습니다');
  fireEvent.change(screen.getByLabelText('기간 끝'), { target: { value: '2026-12-31' } });
  await waitFor(() => expect(asked.at(-1)).toBe('to=2026-12-31'));
});

test('a column header sorts, and sorts the other way the second time', async () => {
  const asked = fakeApi(() => json({ items: [row(1, {})] }));
  openAt('/table');
  await screen.findByRole('link', { name: '항목 1' });
  fireEvent.click(screen.getByRole('button', { name: '비용' }));
  await waitFor(() => expect(asked.at(-1)).toBe('sort=costKrw&order=asc'));
  expect(await screen.findByRole('columnheader', { name: /비용/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  fireEvent.click(screen.getByRole('button', { name: /비용/ }));
  await waitFor(() => expect(asked.at(-1)).toBe('sort=costKrw&order=desc'));
  await waitFor(() =>
    expect(screen.getByRole('columnheader', { name: /비용/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    ),
  );
});

test('a server validation error is shown in Korean and the last rows stay', async () => {
  fakeApi((search) =>
    search.includes('costMin')
      ? json({ error: '최소 비용은(는) 2147483647원 이하의 0 이상 정수로 입력해 주세요' }, 400)
      : json({ items: [row(1, {})] }),
  );
  openAt('/table');
  await screen.findByRole('link', { name: '항목 1' });
  const cost = screen.getByLabelText('최소 비용(원)');
  fireEvent.change(cost, { target: { value: '비쌈' } });
  fireEvent.blur(cost);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '최소 비용은(는) 2147483647원 이하의 0 이상 정수로 입력해 주세요',
  );
  expect(screen.getByRole('link', { name: '항목 1' })).toBeInTheDocument();
});

test('clearing the conditions empties the address and the fields', async () => {
  fakeApi(() => json({ items: [row(1, {})] }));
  openAt('/table?q=abc&status=done');
  await screen.findByRole('link', { name: '항목 1' });
  fireEvent.click(screen.getByRole('button', { name: '조건 지우기' }));
  await waitFor(() => expect(window.location.search).toBe(''));
  expect(screen.getByLabelText('검색(제목, 분야별 정보)')).toHaveValue('');
  expect(screen.getByRole('combobox', { name: '상태' })).toHaveTextContent('전체');
  expect(screen.queryByRole('button', { name: '조건 지우기' })).toBeNull();
});

test('a slow answer for an old filter cannot replace the current one', async () => {
  let release: (response: Response) => void = () => {};
  const held = new Promise<Response>((resolve) => {
    release = resolve;
  });
  fakeApi((search) =>
    search === 'status=done' ? held : json({ items: [row(2, { title: '지금 조건' })] }),
  );
  openAt('/table?status=done');
  await choose('상태', '하고 싶음');
  expect(await screen.findByRole('link', { name: '지금 조건' })).toBeInTheDocument();
  await act(async () => {
    release(json({ items: [row(1, { title: '옛 조건' })] }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(screen.getByRole('link', { name: '지금 조건' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '옛 조건' })).toBeNull();
});
