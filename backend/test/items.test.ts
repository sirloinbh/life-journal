import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

const TODAY = '2026-10-31';
const book = { category: 'reading', title: '데미안' };

// Invalid input must be rejected before any query reaches the database.
function untouchedPool() {
  const fail = () => {
    throw new Error('The database must not be used for invalid input');
  };
  return { query: fail, connect: fail } as unknown as Pool;
}

const rejected: { name: string; body: unknown; error: string }[] = [
  {
    name: 'an unknown category',
    body: { ...book, category: 'music' },
    error: 'The category is not valid',
  },
  { name: 'a blank title', body: { ...book, title: '   ' }, error: 'Title is required' },
  { name: 'a missing title', body: { category: 'reading' }, error: 'Title is required' },
  {
    name: 'an empty array as the title',
    body: { ...book, title: [] },
    error: 'Title must be text',
  },
  {
    name: 'a long array as the title',
    body: { ...book, title: Array.from({ length: 201 }, () => 'x') },
    error: 'Title must be text',
  },
  {
    name: 'an unknown status',
    body: { ...book, status: 'doing' },
    error: 'Status must be wishlist or done',
  },
  {
    name: 'an unknown field',
    body: { ...book, nickname: '책' },
    error: 'The request contains an unknown field',
  },
  {
    name: 'a date in the wrong format',
    body: { ...book, plannedDate: '2026/11/01' },
    error: 'Planned date must be a real date in YYYY-MM-DD format',
  },
  {
    name: 'a date that does not exist',
    body: { ...book, plannedDate: '2026-02-30' },
    error: 'Planned date must be a real date in YYYY-MM-DD format',
  },
  {
    name: 'a month that does not exist',
    body: { ...book, plannedDate: '2026-13-01' },
    error: 'Planned date must be a real date in YYYY-MM-DD format',
  },
  {
    name: 'year zero, which PostgreSQL cannot store',
    body: { ...book, plannedDate: '0000-01-01' },
    error: 'Planned date must be a real date in YYYY-MM-DD format',
  },
  {
    name: 'a negative cost',
    body: { ...book, costKrw: -1 },
    error: 'Cost must be a whole number of won, 0 or more',
  },
  {
    name: 'a fractional cost',
    body: { ...book, costKrw: 1000.5 },
    error: 'Cost must be a whole number of won, 0 or more',
  },
  {
    name: 'a negative fractional cost, with the message only once',
    body: { ...book, costKrw: -1.5 },
    error: 'Cost must be a whole number of won, 0 or more',
  },
  {
    name: 'a fractional vintage below the range, with the message only once',
    body: { category: 'drink', subtype: 'wine', title: '샤블리', details: { vintage: 1.5 } },
    error: 'Vintage must be a 4-digit year',
  },
  {
    name: 'a cost given as text',
    body: { ...book, costKrw: '1000' },
    error: 'Cost must be a whole number of won, 0 or more',
  },
  {
    name: 'a cost too large for the column',
    body: { ...book, costKrw: 2_147_483_648 },
    error: 'Cost must be 2147483647 won or less',
  },
  {
    name: 'a subtype on a category without subtypes',
    body: { ...book, subtype: 'novel' },
    error: 'Reading items cannot have a subtype',
  },
  {
    name: 'a missing subtype on a category that needs one',
    body: { category: 'screen', title: '기생충' },
    error: 'The subtype is not valid for Movies & TV items',
  },
  {
    name: 'a subtype of another category',
    body: { category: 'drink', subtype: 'opera', title: '샤블리' },
    error: 'The subtype is not valid for Drinks items',
  },
  {
    name: 'a details field of another category',
    body: { ...book, details: { director: '봉준호' } },
    error: 'Reading details contain an unknown field',
  },
  {
    name: 'a details field that coffee does not have',
    body: { category: 'coffee', title: '에티오피아 예가체프', details: { vintage: 2024 } },
    error: 'Coffee details contain an unknown field',
  },
  {
    name: 'a subtype on coffee, which has none',
    body: { category: 'coffee', subtype: 'wine', title: '에티오피아 예가체프' },
    error: 'Coffee items cannot have a subtype',
  },
  {
    name: 'a coffee details value that is not text',
    body: { category: 'coffee', title: '에티오피아 예가체프', details: { brewMethod: 1 } },
    error: 'Brew method must be text',
  },
  {
    name: 'details that are not an object',
    body: { ...book, details: '헤세' },
    error: 'Category details are not valid',
  },
  {
    name: 'a details value of the wrong type',
    body: { category: 'drink', subtype: 'wine', title: '샤블리', details: { vintage: '2019' } },
    error: 'Vintage must be a 4-digit year',
  },
  {
    name: 'a NUL character in details, which jsonb cannot store',
    body: { ...book, details: { author: '헤\0세' } },
    error: 'Author contains a character that is not allowed',
  },
  {
    name: 'a lone surrogate in details, which jsonb cannot store',
    body: { ...book, details: { author: '헤\ud800세' } },
    error: 'Author contains a character that is not allowed',
  },
  ...[0, 5.5, 4.3, '4'].map((rating) => ({
    name: `an overall rating of ${JSON.stringify(rating)}`,
    body: { ...book, status: 'done', completedDate: '2026-10-01', rating },
    error: 'Overall rating must be from 0.5 to 5 in steps of 0.5',
  })),
  {
    name: 'a sub-rating out of range',
    body: {
      ...book,
      status: 'done',
      completedDate: '2026-10-01',
      subRatings: { content: 6 },
    },
    error: 'Content must be from 0.5 to 5 in steps of 0.5',
  },
  {
    name: 'a sub-rating criterion of another category',
    body: {
      ...book,
      status: 'done',
      completedDate: '2026-10-01',
      subRatings: { acting: 4 },
    },
    error: 'Reading ratings contain an unknown criterion',
  },
  {
    name: 'a sub-rating criterion that coffee does not have',
    body: {
      category: 'coffee',
      title: '에티오피아 예가체프',
      status: 'done',
      completedDate: '2026-10-01',
      subRatings: { taste: 4 },
    },
    error: 'Coffee ratings contain an unknown criterion',
  },
  {
    name: 'sub-ratings that are not an object',
    body: { ...book, status: 'done', completedDate: '2026-10-01', subRatings: 4 },
    error: 'Ratings are not valid',
  },
  {
    name: 'a rating on a wishlist item',
    body: { ...book, rating: 4 },
    error: 'Items that are not done cannot have a rating',
  },
  {
    name: 'a sub-rating on a wishlist item',
    body: { ...book, subRatings: { content: 4 } },
    error: 'Items that are not done cannot have a rating',
  },
  ...[
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,hello',
    'ftp://example.com/file',
    'example.com',
    'https://',
    'http://exa mple.com',
    '//example.com',
  ].map((link) => ({
    name: `a link of ${link}`,
    body: { ...book, link },
    error: 'Link must be an address that starts with http:// or https://',
  })),
  {
    name: 'a link that is not text',
    body: { ...book, link: 5 },
    error: 'Link must be an address that starts with http:// or https://',
  },
  {
    name: 'a link of 2001 characters',
    body: { ...book, link: `https://example.com/${'a'.repeat(1981)}` },
    error: 'Link must be 2000 characters or fewer',
  },
  {
    name: 'a review of 6 lines',
    body: {
      ...book,
      status: 'done',
      completedDate: '2026-10-01',
      review: 'ㄱ\nㄴ\nㄷ\nㄹ\nㅁ\nㅂ',
    },
    error: 'Review must be 5 lines or fewer',
  },
  {
    name: 'a review of 6 lines with Windows line ends',
    body: {
      ...book,
      status: 'done',
      completedDate: '2026-10-01',
      review: 'ㄱ\r\nㄴ\r\nㄷ\r\nㄹ\r\nㅁ\r\nㅂ',
    },
    error: 'Review must be 5 lines or fewer',
  },
  ...[
    ['CR', 'ㄱ\rㄴ\rㄷ\rㄹ\rㅁ\rㅂ'],
    ['Unicode', 'ㄱ\u2028ㄴ\u2029ㄷ\u0085ㄹ\u2028ㅁ\u2029ㅂ'],
  ].map(([kind, review]) => ({
    name: `a review of 6 lines with ${kind} line separators`,
    body: { ...book, status: 'done', completedDate: '2026-10-01', review },
    error: 'Review must be 5 lines or fewer',
  })),
  {
    name: 'a review of 251 emoji, which count as 2 characters each',
    body: { ...book, status: 'done', completedDate: '2026-10-01', review: '😀'.repeat(251) },
    error: 'Review must be 500 characters or fewer',
  },
  {
    name: 'a lone surrogate in a review',
    body: { ...book, status: 'done', completedDate: '2026-10-01', review: '좋\ud800음' },
    error: 'Review contains a character that is not allowed',
  },
  {
    name: 'a review of 501 characters',
    body: { ...book, status: 'done', completedDate: '2026-10-01', review: '가'.repeat(501) },
    error: 'Review must be 500 characters or fewer',
  },
  {
    name: 'a review that is not text',
    body: { ...book, status: 'done', completedDate: '2026-10-01', review: 5 },
    error: 'Review must be text',
  },
  {
    name: 'a NUL character in a review',
    body: { ...book, status: 'done', completedDate: '2026-10-01', review: '좋\0음' },
    error: 'Review contains a character that is not allowed',
  },
  {
    name: 'a review on a wishlist item',
    body: { ...book, review: '좋았다' },
    error: 'Items that are not done cannot have a review',
  },
  {
    name: 'a done item without a completed date',
    body: { ...book, status: 'done' },
    error: 'Completed items need a completed date',
  },
  {
    name: 'a wishlist item with a completed date',
    body: { ...book, completedDate: '2026-10-01' },
    error: 'Items that are not done cannot have a completed date',
  },
  {
    name: 'a completed date after the service date',
    body: { ...book, status: 'done', completedDate: '2026-11-01' },
    error: 'Completed date cannot be after today',
  },
];

for (const { name, body, error } of rejected) {
  test(`creating an item with ${name} is a Korean 400`, async () => {
    await withApi(
      untouchedPool(),
      async (call) => {
        const response = await call('/api/items', { method: 'POST', body });
        assert.equal(response.status, 400);
        assert.deepEqual(response.data, { error });
      },
      { today: () => TODAY },
    );
  });
}

for (const [query, error] of [
  ['category=music', 'The category is not valid'],
  ['status=doing', 'Status must be wishlist or done'],
  ['from=2026-02-30', 'Start date must be a real date in YYYY-MM-DD format'],
  ['to=tomorrow', 'End date must be a real date in YYYY-MM-DD format'],
  ['from=2026-02-01&to=2026-01-01', 'Start date cannot be after end date'],
  ['costMin=-1', `Minimum cost must be a whole number from 0 to 2147483647`],
  ['costMax=1.5', `Maximum cost must be a whole number from 0 to 2147483647`],
  ['costMax=2147483648', `Maximum cost must be a whole number from 0 to 2147483647`],
  ['costMin=2&costMax=1', 'Minimum cost cannot be greater than maximum cost'],
  ['sort=password', 'Sort field is not valid'],
  ['sort=title;DROP%20TABLE%20items', 'Sort field is not valid'],
  ['order=sideways', 'Sort order is not valid'],
  ['q=a&q=b', 'Search term must be a single value'],
  ['from=2026-01-01&from=2026-01-02', 'Start date must be a real date in YYYY-MM-DD format'],
  ['category=reading&category=travel', 'The category is not valid'],
  ['costMin=1&costMin=2', `Minimum cost must be a whole number from 0 to 2147483647`],
  [`q=${'가'.repeat(101)}`, 'Search term must be 100 characters or fewer'],
  ['q=%00', 'Search term contains a character that is not allowed'],
  ['nickname=x', 'The search contains an unknown filter'],
] as const) {
  test(`listing items with ${query.slice(0, 40)} is a Korean 400`, async () => {
    await withApi(untouchedPool(), async (call) => {
      const response = await call(`/api/items?${encodeURI(query).replaceAll('%25', '%')}`);
      assert.equal(response.status, 400);
      assert.deepEqual(response.data, { error });
    });
  });
}

test('a body that is not valid JSON is a Korean 400', async () => {
  await withApi(untouchedPool(), async (call) => {
    const { status, data } = await call('/api/items', { method: 'POST', rawBody: '{"title":' });
    assert.equal(status, 400);
    assert.deepEqual(data, { error: 'Request body is not valid JSON' });
  });
});

test('creating an item without a body is a Korean 400', async () => {
  await withApi(untouchedPool(), async (call) => {
    const { status, data } = await call('/api/items', { method: 'POST' });
    assert.equal(status, 400);
    assert.deepEqual(data, { error: 'Request body is required' });
  });
});

// The screen's table in frontend/src/bucket-list.test.tsx must list the same keys.
const criteriaByCategory = {
  reading: { subtype: null, keys: ['content', 'prose', 'afterglow'] },
  screen: { subtype: 'movie', keys: ['story', 'direction', 'acting'] },
  stage: { subtype: 'opera', keys: ['acting', 'direction', 'stage', 'music'] },
  drink: { subtype: 'wine', keys: ['aroma', 'taste', 'finish', 'value'] },
  travel: { subtype: null, keys: ['scenery', 'food', 'lodging', 'transport'] },
  coffee: { subtype: null, keys: ['aroma', 'acidity', 'sweetness', 'body', 'finish'] },
};

for (const [category, { subtype, keys }] of Object.entries(criteriaByCategory)) {
  test(`${category}: every sub-rating criterion and both score limits are accepted`, async () => {
    const queries: unknown[][] = [];
    const pool = {
      query: async (_sql: string, values: unknown[]) => {
        queries.push(values);
        return { rows: [{ id: 1 }] };
      },
    } as unknown as Pool;
    const subRatings = Object.fromEntries(keys.map((key, index) => [key, index ? 5 : 0.5]));
    await withApi(
      pool,
      async (call) => {
        const { status } = await call('/api/items', {
          method: 'POST',
          body: {
            category,
            subtype,
            title: '기록',
            status: 'done',
            completedDate: TODAY,
            rating: 0.5,
            subRatings,
          },
        });
        assert.equal(status, 201);
      },
      { today: () => TODAY },
    );
    assert.equal(queries[0]?.[8], 0.5);
    assert.deepEqual(queries[0]?.[9], subRatings);
  });
}

for (const [name, review, stored] of [
  ['5 lines and 500 characters', `${'가'.repeat(495)}\n\n\n\n나`, `${'가'.repeat(495)}\n\n\n\n나`],
  ['surrounding space and Windows line ends', '  첫 줄\r\n둘째 줄\n\n ', '첫 줄\n둘째 줄'],
  ['only blanks, which clear it', ' \n ', null],
  ['250 emoji', '😀'.repeat(250), '😀'.repeat(250)],
] as const) {
  test(`a review with ${name} is accepted`, async () => {
    const queries: unknown[][] = [];
    const pool = {
      query: async (_sql: string, values: unknown[]) => {
        queries.push(values);
        return { rows: [{ id: 1 }] };
      },
    } as unknown as Pool;
    await withApi(
      pool,
      async (call) => {
        const { status } = await call('/api/items', {
          method: 'POST',
          body: { ...book, status: 'done', completedDate: TODAY, review },
        });
        assert.equal(status, 201);
      },
      { today: () => TODAY },
    );
    assert.equal(queries[0]?.[10], stored);
  });
}

for (const [link, stored] of [
  ['https://www.vivino.com/wines/1?year=2019', 'https://www.vivino.com/wines/1?year=2019'],
  ['  HTTP://example.com  ', 'HTTP://example.com'],
  [`https://example.com/${'a'.repeat(1980)}`, `https://example.com/${'a'.repeat(1980)}`],
  ['', null],
  [null, null],
] as const) {
  test(`a link of ${String(link).slice(0, 40)} is stored without being fetched`, async (t) => {
    const fetched = t.mock.method(globalThis, 'fetch', () => {
      throw new Error('The server must not fetch a link');
    });
    const queries: unknown[][] = [];
    const pool = {
      query: async (_sql: string, values: unknown[]) => {
        queries.push(values);
        return { rows: [{ id: 1 }] };
      },
    } as unknown as Pool;
    await withApi(pool, async (call) => {
      const { status } = await call('/api/items', { method: 'POST', body: { ...book, link } });
      assert.equal(status, 201);
    });
    assert.equal(queries[0]?.[11], stored);
    assert.equal(fetched.mock.callCount(), 0);
  });
}

test('a completed date on the service date itself is accepted', async () => {
  const params: unknown[][] = [];
  const pool = {
    query: async (_sql: string, values: unknown[]) => {
      params.push(values);
      return { rows: [{ id: 1 }] };
    },
  } as unknown as Pool;
  await withApi(
    pool,
    async (call) => {
      const { status } = await call('/api/items', {
        method: 'POST',
        body: { ...book, status: 'done', completedDate: TODAY },
      });
      assert.equal(status, 201);
    },
    { today: () => TODAY },
  );
  assert.equal(params.length, 1);
  assert.equal(params[0]?.[6], TODAY);
});

test('a failed ROLLBACK keeps the original error and discards the connection', async () => {
  const released: unknown[] = [];
  const client = {
    on: () => {},
    off: () => {},
    release: (broken: unknown) => released.push(broken),
    query: async (sql: string) => {
      if (sql === 'ROLLBACK') throw new Error('connection lost');
      return { rows: [] };
    },
  };
  const pool = { connect: async () => client } as unknown as Pool;
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/items/1', {
      method: 'PATCH',
      body: { title: '수정' },
    });
    assert.equal(status, 404);
    assert.deepEqual(data, { error: 'Item not found' });
  });
  assert.deepEqual(released, [true]);
});

test('malformed item ids and empty patches are Korean 400s', async () => {
  await withApi(untouchedPool(), async (call) => {
    for (const [path, init] of [
      ['/api/items/abc', { method: 'GET' }],
      ['/api/items/0', { method: 'DELETE' }],
      ['/api/items/1.5', { method: 'PATCH', body: { title: '수정' } }],
    ] as const) {
      const { status, data } = await call(path, init);
      assert.equal(status, 400, `${init.method} ${path}`);
      assert.deepEqual(data, { error: 'Invalid item ID' });
    }
    const { status, data } = await call('/api/items/1', { method: 'PATCH', body: {} });
    assert.equal(status, 400);
    assert.deepEqual(data, { error: 'Nothing to update' });
  });
});
