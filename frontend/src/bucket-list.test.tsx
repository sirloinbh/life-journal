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
    rating: null,
    subRatings: {},
    review: null,
    link: null,
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
          ? json({ error: 'A server error occurred' }, 500)
          : json({ items: api.items });
      }
      const body = (init.body ? JSON.parse(init.body) : {}) as Record<string, unknown>;
      api.requests.push({ method, path, body });
      if (api.failNext) {
        const { status, error } = api.failNext;
        api.failNext = null;
        return json({ error }, status);
      }
      if (body.title === '') return json({ error: 'Title is required' }, 400);
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
  { tab: 'Reading', key: 'reading', field: 'Author (optional)', detail: { author: '헤세' } },
  {
    tab: 'Movies & TV',
    key: 'screen',
    subtype: ['Movie', 'movie'],
    field: 'Director (optional)',
    detail: { director: '헤세' },
  },
  {
    tab: 'Stage',
    key: 'stage',
    subtype: ['Opera', 'opera'],
    field: 'Venue (optional)',
    detail: { venue: '헤세' },
  },
  {
    tab: 'Drinks',
    key: 'drink',
    subtype: ['Wine', 'wine'],
    field: 'Producer (optional)',
    detail: { producer: '헤세' },
  },
  { tab: 'Travel', key: 'travel', field: 'City (optional)', detail: { city: '헤세' } },
  { tab: 'Coffee', key: 'coffee', field: 'Brew method (optional)', detail: { brewMethod: '헤세' } },
] as const;

for (const { tab, key, field, detail, ...rest } of cases) {
  const subtype = 'subtype' in rest ? rest.subtype : undefined;

  test(`${tab}: an item is added, edited, marked done, reopened, and deleted`, async () => {
    const api = fakeApi();
    openAt('/bucket-list');
    const tabs = await screen.findByRole('navigation', { name: 'Category' });
    fireEvent.click(within(tabs).getByRole('link', { name: tab }));
    expect(window.location.pathname).toBe(`/bucket-list/${key}`);

    let dialog = await openDialog('Add item');
    type(dialog, 'Title', '  첫 항목  ');
    type(dialog, field, '헤세');
    type(dialog, 'Cost (KRW, optional)', '15,000');
    type(dialog, 'Planned date (optional)', '2027-03-01');
    if (subtype) await choose(dialog, 'Subtype', subtype[0]);
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
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
        link: null,
        details: detail,
      },
    });
    expect(await screen.findByText('첫 항목')).toBeInTheDocument();
    expect(screen.getByText(/Cost ₩15,000 · Planned March 1, 2027/)).toBeInTheDocument();

    dialog = await openDialog('Edit 첫 항목');
    expect(dialog.getByLabelText('Title')).toHaveValue('첫 항목');
    expect(dialog.getByLabelText(field)).toHaveValue('헤세');
    type(dialog, 'Title', '고친 항목');
    type(dialog, 'Cost (KRW, optional)', '');
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await dialogClosed();
    expect(api.requests.at(-1)?.method).toBe('PATCH');
    expect(api.requests.at(-1)?.body).toMatchObject({ title: '고친 항목', costKrw: null });

    dialog = await openDialog('Mark 고친 항목 as done');
    expect(dialog.getByLabelText('Completed date')).toHaveValue(TODAY);
    fireEvent.click(dialog.getByRole('button', { name: 'Mark as done' }));
    await dialogClosed();
    expect(api.requests.at(-1)?.body).toEqual({ status: 'done', completedDate: TODAY });
    expect(await screen.findByText(new RegExp(`Completed October 31, 2026`))).toBeInTheDocument();

    dialog = await openDialog('Undo done for 고친 항목');
    fireEvent.click(dialog.getByRole('button', { name: 'Undo done' }));
    await dialogClosed();
    expect(api.requests.at(-1)?.body).toEqual({
      status: 'wishlist',
      completedDate: null,
      rating: null,
      subRatings: {},
      review: null,
    });

    dialog = await openDialog('Delete 고친 항목');
    fireEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    await dialogClosed();
    expect(api.requests.at(-1)?.method).toBe('DELETE');
    expect(await screen.findByText(`No ${tab} items`)).toBeInTheDocument();
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
  const tabs = screen.getByRole('navigation', { name: 'Category' });
  expect(within(tabs).getByRole('link', { name: 'Reading' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  fireEvent.click(within(tabs).getByRole('link', { name: 'Travel' }));
  expect(await screen.findByText('교토')).toBeInTheDocument();
  expect(screen.queryByText('데미안')).toBeNull();
});

test('the main menu link opens the first category', async () => {
  fakeApi();
  openAt('/');
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Bucket list' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Bucket list' })).toBeInTheDocument();
  await waitFor(() => expect(window.location.pathname).toBe('/bucket-list/reading'));
  expect(within(menu).getByRole('link', { name: 'Bucket list' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('an unknown category address falls back to the first category', async () => {
  fakeApi();
  openAt('/bucket-list/no-such-category');
  await waitFor(() => expect(window.location.pathname).toBe('/bucket-list/reading'));
  expect(await screen.findByText('No Reading items')).toBeInTheDocument();
});

test('item titles follow the page heading order', async () => {
  fakeApi([{ title: '데미안' }]);
  openAt('/bucket-list/reading');
  expect(await screen.findByRole('heading', { level: 2, name: /데미안/ })).toBeInTheDocument();
});

test('a server validation error stays in the open form in Korean', async () => {
  const api = fakeApi();
  openAt('/bucket-list/reading');
  const dialog = await openDialog('Add item');
  type(dialog, 'Author (optional)', '헤세');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent('Title is required');
  expect(dialog.getByLabelText('Author (optional)')).toHaveValue('헤세');
  expect(dialog.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(api.items).toHaveLength(0);
});

test('every drink field is sent, and the vintage as a number', async () => {
  const api = fakeApi();
  openAt('/bucket-list/drink');
  const dialog = await openDialog('Add item');
  type(dialog, 'Title', '샤블리');
  await choose(dialog, 'Subtype', 'Wine');
  type(dialog, 'Producer (optional)', 'Domaine');
  type(dialog, 'Region (optional)', '부르고뉴');
  type(dialog, 'Vintage (optional)', '2019');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await dialogClosed();
  expect(api.requests.at(-1)?.body.details).toEqual({
    producer: 'Domaine',
    region: '부르고뉴',
    vintage: 2019,
  });
});

for (const text of ['expensive', '15.000', '1e3', '1,5']) {
  test(`a cost of ${text} is left for the server to explain`, async () => {
    const api = fakeApi();
    api.failNext = { status: 400, error: 'Cost must be a whole number of won, 0 or more' };
    openAt('/bucket-list/reading');
    const dialog = await openDialog('Add item');
    type(dialog, 'Title', '데미안');
    type(dialog, 'Cost (KRW, optional)', text);
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'Cost must be a whole number of won, 0 or more',
    );
    expect(api.requests.at(-1)?.body.costKrw).toBe(text);
  });
}

test('the completed date defaults to today in Asia/Seoul, not UTC', async () => {
  vi.setSystemTime(new Date('2026-10-31T15:00:00Z'));
  fakeApi([{ title: '데미안' }]);
  openAt('/bucket-list/reading');
  const dialog = await openDialog('Mark 데미안 as done');
  expect(dialog.getByLabelText('Completed date')).toHaveValue('2026-11-01');
});

test('a rejected completed date stays in the completion dialog', async () => {
  const api = fakeApi([{ title: '데미안' }]);
  api.failNext = { status: 400, error: 'Completed date cannot be after today' };
  openAt('/bucket-list/reading');
  const dialog = await openDialog('Mark 데미안 as done');
  type(dialog, 'Completed date', '2027-01-01');
  fireEvent.click(dialog.getByRole('button', { name: 'Mark as done' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent(
    'Completed date cannot be after today',
  );
});

// The server's table in backend/test/items.test.ts must list the same keys.
const criteriaByCategory = {
  reading: { Content: 'content', Prose: 'prose', 'Lingering impression': 'afterglow' },
  screen: { Story: 'story', Direction: 'direction', Acting: 'acting' },
  stage: { Acting: 'acting', Direction: 'direction', Staging: 'stage', Music: 'music' },
  drink: { Aroma: 'aroma', Taste: 'taste', 'Lingering impression': 'finish', Value: 'value' },
  travel: { Scenery: 'scenery', Food: 'food', Lodging: 'lodging', Transport: 'transport' },
  coffee: {
    Aroma: 'aroma',
    Acidity: 'acidity',
    Sweetness: 'sweetness',
    Body: 'body',
    'Lingering impression': 'finish',
  },
};

for (const [category, criteria] of Object.entries(criteriaByCategory)) {
  test(`${category}: the rating form shows and sends the criteria of its category`, async () => {
    const api = fakeApi([{ category, title: 'Log', status: 'done', completedDate: '2026-10-01' }]);
    openAt(`/bucket-list/${category}`);
    const dialog = await openDialog('Rate Log');
    expect(dialog.getAllByRole('combobox')).toHaveLength(Object.keys(criteria).length + 1);
    expect(dialog.getByRole('combobox', { name: 'Overall rating' })).toBeInTheDocument();
    const expected: Record<string, number> = {};
    for (const [name, key] of Object.entries(criteria)) {
      await choose(dialog, name, '3.5');
      expected[key] = 3.5;
    }
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await dialogClosed();
    expect(api.requests.at(-1)?.body).toEqual({ rating: null, subRatings: expected });
  });
}

test('a link is saved, opens in a new tab, and can be cleared', async () => {
  const api = fakeApi([{ title: '데미안' }]);
  openAt('/bucket-list/reading');
  let dialog = await openDialog('Edit 데미안');
  type(dialog, 'Link (optional)', ' https://example.com/book ');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await dialogClosed();
  expect(api.requests.at(-1)?.body.link).toBe('https://example.com/book');
  const link = await screen.findByRole('link', { name: 'Open link for 데미안' });
  expect(link).toHaveAttribute('href', 'https://example.com/book');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');

  dialog = await openDialog('Edit 데미안');
  expect(dialog.getByLabelText('Link (optional)')).toHaveValue('https://example.com/book');
  type(dialog, 'Link (optional)', '');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await dialogClosed();
  expect(api.requests.at(-1)?.body.link).toBeNull();
  await waitFor(() =>
    expect(screen.queryByRole('link', { name: 'Open link for 데미안' })).toBeNull(),
  );
});

test('a rejected link stays in the form in Korean', async () => {
  const api = fakeApi([{ title: '데미안' }]);
  api.failNext = {
    status: 400,
    error: 'Link must be an address that starts with http:// or https://',
  };
  openAt('/bucket-list/reading');
  const dialog = await openDialog('Edit 데미안');
  type(dialog, 'Link (optional)', 'javascript:alert(1)');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent(
    'Link must be an address that starts with http:// or https://',
  );
  expect(api.requests.at(-1)?.body.link).toBe('javascript:alert(1)');
});

test('only done items can be rated or reviewed', async () => {
  fakeApi([{ title: '데미안' }]);
  openAt('/bucket-list/reading');
  await screen.findByText('데미안');
  expect(screen.queryByRole('button', { name: 'Rate 데미안' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Review 데미안' })).toBeNull();
});

const doneBook = { title: '데미안', status: 'done', completedDate: '2026-10-01' } as const;

test('a review is written, previewed by its first line, edited, and cleared', async () => {
  const api = fakeApi([doneBook]);
  openAt('/bucket-list/reading');
  let dialog = await openDialog('Review 데미안');
  type(dialog, 'Review', '  First line\nSecond line  ');
  expect(dialog.getByText('2/5 lines · 22/500 characters')).toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await dialogClosed();
  expect(api.requests.at(-1)?.body).toEqual({ review: 'First line\nSecond line' });
  expect(await screen.findByText('First line')).toBeInTheDocument();
  expect(screen.queryByText(/Second line/)).toBeNull();

  dialog = await openDialog('Review 데미안');
  expect(dialog.getByLabelText('Review')).toHaveValue('First line\nSecond line');
  type(dialog, 'Review', 'Edited first line\nEdited second line');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await dialogClosed();
  expect(api.requests.at(-1)?.body).toEqual({ review: 'Edited first line\nEdited second line' });
  expect(await screen.findByText('Edited first line')).toBeInTheDocument();
  expect(screen.queryByText('첫 줄')).toBeNull();

  dialog = await openDialog('Review 데미안');
  type(dialog, 'Review', '   ');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await dialogClosed();
  expect(api.requests.at(-1)?.body).toEqual({ review: null });
  await waitFor(() => expect(screen.queryByText('Edited first line')).toBeNull());
});

test('the preview skips lines that show nothing', async () => {
  fakeApi([
    { ...doneBook, review: '\u200b\nOnly the second line shows' },
    { ...doneBook, title: '수레바퀴', review: '\u200b' },
  ]);
  openAt('/bucket-list/reading');
  expect(await screen.findByText('Only the second line shows')).toBeInTheDocument();
  const card = screen.getByRole('heading', { name: /수레바퀴/ }).closest('[data-slot="card"]');
  // Only the summary line with the completed date remains.
  expect(card?.querySelectorAll('[data-slot="card-content"] p')).toHaveLength(1);
});

for (const blank of ['\u200e', '\u00ad', '\u115f', '\u1160', '\u2800', '\u3164', '\uffa0']) {
  const code = blank.codePointAt(0)!.toString(16);
  test(`the preview skips a first line of only U+${code}`, async () => {
    fakeApi([{ ...doneBook, review: `${blank}\nOnly the second line shows` }]);
    openAt('/bucket-list/reading');
    expect(await screen.findByText('Only the second line shows')).toBeInTheDocument();
  });
}

test('other line separators count as lines, like on the server', async () => {
  const api = fakeApi([doneBook]);
  openAt('/bucket-list/reading');
  const dialog = await openDialog('Review 데미안');
  type(dialog, 'Review', 'ㄱ\u2028ㄴ\u2029ㄷ\u0085ㄹ\rㅁ\r\nㅂ');
  expect(dialog.getByText('6/5 lines · 11/500 characters')).toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent('Review must be 5 lines or fewer');
  expect(api.requests).toHaveLength(0);
});

test('editing the review clears the previous error', async () => {
  fakeApi([doneBook]);
  openAt('/bucket-list/reading');
  const dialog = await openDialog('Review 데미안');
  type(dialog, 'Review', 'ㄱ\nㄴ\nㄷ\nㄹ\nㅁ\nㅂ');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await dialog.findByRole('alert');
  type(dialog, 'Review', 'ㄱ');
  expect(dialog.queryByRole('alert')).toBeNull();
});

for (const [name, text, message] of [
  ['6 lines', 'ㄱ\nㄴ\nㄷ\nㄹ\nㅁ\nㅂ', 'Review must be 5 lines or fewer'],
  ['501 characters', '가'.repeat(501), 'Review must be 500 characters or fewer'],
] as const) {
  test(`a review of ${name} is stopped in the form without a request`, async () => {
    const api = fakeApi([doneBook]);
    openAt('/bucket-list/reading');
    const dialog = await openDialog('Review 데미안');
    type(dialog, 'Review', text);
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(message);
    expect(api.requests).toHaveLength(0);
  });
}

test('5 lines and 500 characters are sent, and a server error stays in the form', async () => {
  const api = fakeApi([doneBook]);
  api.failNext = { status: 400, error: 'Review contains a character that is not allowed' };
  openAt('/bucket-list/reading');
  const dialog = await openDialog('Review 데미안');
  const text = `${'가'.repeat(495)}\n\n\n\n나`;
  type(dialog, 'Review', text);
  expect(dialog.getByText('5/5 lines · 500/500 characters')).toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent(
    'Review contains a character that is not allowed',
  );
  expect(api.requests.at(-1)?.body).toEqual({ review: text });
  expect(dialog.getByLabelText('Review')).toHaveValue(text);
});

test('a done item gets a rating and sub-ratings, shown with their average', async () => {
  const api = fakeApi([{ title: '데미안', status: 'done', completedDate: '2026-10-01' }]);
  openAt('/bucket-list/reading');
  let dialog = await openDialog('Rate 데미안');
  await choose(dialog, 'Overall rating', '4.5');
  await choose(dialog, 'Content', '5');
  await choose(dialog, 'Lingering impression', '4');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await dialogClosed();
  expect(api.requests.at(-1)?.body).toEqual({
    rating: 4.5,
    subRatings: { content: 5, afterglow: 4 },
  });
  expect(await screen.findByText('Rating 4.5')).toBeInTheDocument();
  expect(
    screen.getByText('Content 5 · Lingering impression 4 (sub-rating average 4.5, for reference)'),
  ).toBeInTheDocument();

  dialog = await openDialog('Rate 데미안');
  expect(dialog.getByRole('combobox', { name: 'Overall rating' })).toHaveTextContent('4.5');
  await choose(dialog, 'Overall rating', 'None');
  await choose(dialog, 'Content', 'None');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await dialogClosed();
  expect(api.requests.at(-1)?.body).toEqual({ rating: null, subRatings: { afterglow: 4 } });
});

test('a rejected rating stays in the rating form in Korean', async () => {
  const api = fakeApi([{ title: '데미안', status: 'done', completedDate: '2026-10-01' }]);
  api.failNext = { status: 400, error: 'Items that are not done cannot have a rating' };
  openAt('/bucket-list/reading');
  const dialog = await openDialog('Rate 데미안');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent(
    'Items that are not done cannot have a rating',
  );
});

test('a done item edits its completed date in the form', async () => {
  const api = fakeApi([{ title: '데미안', status: 'done', completedDate: '2026-10-01' }]);
  openAt('/bucket-list/reading');
  const dialog = await openDialog('Edit 데미안');
  expect(dialog.getByLabelText('Completed date')).toHaveValue('2026-10-01');
  type(dialog, 'Completed date', '2026-10-02');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await dialogClosed();
  expect(api.requests.at(-1)?.body.completedDate).toBe('2026-10-02');
});

test('the form cannot close while saving, so a failure is still shown', async () => {
  const api = fakeApi();
  const held = gate();
  openAt('/bucket-list/reading');
  const dialog = await openDialog('Add item');
  type(dialog, 'Title', '데미안');
  api.gate = held.promise;
  api.failNext = { status: 500, error: 'A server error occurred' };
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(dialog.getByRole('button', { name: /Save/ })).toBeDisabled());
  pressEscape();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  api.gate = null;
  held.open();
  expect(await dialog.findByRole('alert')).toHaveTextContent('A server error occurred');
  pressEscape();
  await dialogClosed();
});

test('changes show the server response even when the reload after them fails', async () => {
  const api = fakeApi([{ title: '데미안', costKrw: 1000 }]);
  openAt('/bucket-list/reading');
  await screen.findByText('데미안');
  api.failList = true;

  let dialog = await openDialog('Add item');
  type(dialog, 'Title', '수레바퀴');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await dialogClosed();
  expect(await screen.findByText('수레바퀴')).toBeInTheDocument();
  expect(screen.getByText('Saved')).toHaveAttribute('role', 'status');
  expect(screen.queryByRole('alert')).toBeNull();

  // The next edit starts from the saved values, so it cannot bring old ones back.
  dialog = await openDialog('Edit 데미안');
  type(dialog, 'Title', '고친 제목');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await dialogClosed();
  dialog = await openDialog('Edit 고친 제목');
  expect(dialog.getByLabelText('Title')).toHaveValue('고친 제목');
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  await dialogClosed();

  dialog = await openDialog('Mark 고친 제목 as done');
  fireEvent.click(dialog.getByRole('button', { name: 'Mark as done' }));
  await dialogClosed();
  dialog = await openDialog('Undo done for 고친 제목');
  fireEvent.click(dialog.getByRole('button', { name: 'Undo done' }));
  await dialogClosed();
  expect(await screen.findByRole('button', { name: 'Mark 고친 제목 as done' })).toBeInTheDocument();

  dialog = await openDialog('Delete 고친 제목');
  fireEvent.click(dialog.getByRole('button', { name: 'Delete' }));
  await dialogClosed();
  await waitFor(() => expect(screen.queryByText('고친 제목')).toBeNull());
  expect(screen.getByText('수레바퀴')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('a slow older list response cannot replace a newer one', async () => {
  const api = fakeApi([{ title: '데미안' }]);
  openAt('/bucket-list/reading');
  const dialog = await openDialog('Edit 데미안');

  // The 404 starts a reload that answers with the old list, late.
  const held = gate();
  api.listGate = held.promise;
  api.failNext = { status: 404, error: 'Item not found' };
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent('Item not found');

  api.listGate = null;
  type(dialog, 'Title', '고친 제목');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
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
  const dialog = await openDialog('Edit 데미안');
  api.items = [];
  api.failNext = { status: 404, error: 'Item not found' };
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent('Item not found');
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  await dialogClosed();
  expect(await screen.findByText('No Reading items')).toBeInTheDocument();
});

test('deleting an item that is already gone reports it and refreshes the list', async () => {
  const api = fakeApi([{ title: '데미안' }]);
  openAt('/bucket-list/reading');
  const dialog = await openDialog('Delete 데미안');
  api.items = [];
  api.failNext = { status: 404, error: 'Item not found' };
  fireEvent.click(dialog.getByRole('button', { name: 'Delete' }));
  await dialogClosed();
  expect(await screen.findByText('Item not found')).toHaveAttribute('role', 'alert');
  expect(await screen.findByText('No Reading items')).toBeInTheDocument();
});

test('a failed list load is reported, and the retry button waits for its request', async () => {
  const api = fakeApi([{ title: '데미안' }]);
  api.failList = true;
  openAt('/bucket-list/reading');
  expect(await screen.findByText('A server error occurred')).toHaveAttribute('role', 'alert');
  const held = gate();
  api.gate = held.promise;
  api.failList = false;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByRole('button', { name: /Try again/ })).toBeDisabled();
  api.gate = null;
  held.open();
  expect(await screen.findByText('데미안')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});

for (const name of ['Add item', 'Edit 데미안', 'Mark 데미안 as done', 'Delete 데미안']) {
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
