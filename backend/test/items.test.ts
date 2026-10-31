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
    error: '분야가 올바르지 않습니다',
  },
  { name: 'a blank title', body: { ...book, title: '   ' }, error: '제목을(를) 입력해 주세요' },
  { name: 'a missing title', body: { category: 'reading' }, error: '제목을(를) 입력해 주세요' },
  {
    name: 'an unknown status',
    body: { ...book, status: 'doing' },
    error: '상태는 하고 싶음(wishlist) 또는 완료(done)여야 합니다',
  },
  {
    name: 'an unknown field',
    body: { ...book, nickname: '책' },
    error: '알 수 없는 항목이 있습니다',
  },
  {
    name: 'a date in the wrong format',
    body: { ...book, plannedDate: '2026/11/01' },
    error: '예정일은(는) YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요',
  },
  {
    name: 'a date that does not exist',
    body: { ...book, plannedDate: '2026-02-30' },
    error: '예정일은(는) YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요',
  },
  {
    name: 'a month that does not exist',
    body: { ...book, plannedDate: '2026-13-01' },
    error: '예정일은(는) YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요',
  },
  {
    name: 'year zero, which PostgreSQL cannot store',
    body: { ...book, plannedDate: '0000-01-01' },
    error: '예정일은(는) YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요',
  },
  {
    name: 'a negative cost',
    body: { ...book, costKrw: -1 },
    error: '비용은 0원 이상의 정수로 입력해 주세요',
  },
  {
    name: 'a fractional cost',
    body: { ...book, costKrw: 1000.5 },
    error: '비용은 0원 이상의 정수로 입력해 주세요',
  },
  {
    name: 'a negative fractional cost, with the message only once',
    body: { ...book, costKrw: -1.5 },
    error: '비용은 0원 이상의 정수로 입력해 주세요',
  },
  {
    name: 'a fractional vintage below the range, with the message only once',
    body: { category: 'drink', subtype: 'wine', title: '샤블리', details: { vintage: 1.5 } },
    error: '빈티지는 4자리 연도로 입력해 주세요',
  },
  {
    name: 'a cost given as text',
    body: { ...book, costKrw: '1000' },
    error: '비용은 0원 이상의 정수로 입력해 주세요',
  },
  {
    name: 'a cost too large for the column',
    body: { ...book, costKrw: 2_147_483_648 },
    error: '비용은 2147483647원 이하로 입력해 주세요',
  },
  {
    name: 'a subtype on a category without subtypes',
    body: { ...book, subtype: 'novel' },
    error: '독서 분야에는 세부 종류를 넣을 수 없습니다',
  },
  {
    name: 'a missing subtype on a category that needs one',
    body: { category: 'screen', title: '기생충' },
    error: '영화·드라마 분야의 세부 종류가 올바르지 않습니다',
  },
  {
    name: 'a subtype of another category',
    body: { category: 'drink', subtype: 'opera', title: '샤블리' },
    error: '와인·위스키·사케 분야의 세부 종류가 올바르지 않습니다',
  },
  {
    name: 'a details field of another category',
    body: { ...book, details: { director: '봉준호' } },
    error: '독서 정보에 없는 항목이 있습니다',
  },
  {
    name: 'details that are not an object',
    body: { ...book, details: '헤세' },
    error: '분야별 정보 형식이 올바르지 않습니다',
  },
  {
    name: 'a details value of the wrong type',
    body: { category: 'drink', subtype: 'wine', title: '샤블리', details: { vintage: '2019' } },
    error: '빈티지는 4자리 연도로 입력해 주세요',
  },
  {
    name: 'a NUL character in details, which jsonb cannot store',
    body: { ...book, details: { author: '헤\0세' } },
    error: '저자에 사용할 수 없는 문자가 있습니다',
  },
  {
    name: 'a lone surrogate in details, which jsonb cannot store',
    body: { ...book, details: { author: '헤\ud800세' } },
    error: '저자에 사용할 수 없는 문자가 있습니다',
  },
  ...[0, 5.5, 4.3, '4'].map((rating) => ({
    name: `an overall rating of ${JSON.stringify(rating)}`,
    body: { ...book, status: 'done', completedDate: '2026-10-01', rating },
    error: '전체 평점은(는) 0.5점부터 5점까지 0.5점 단위로 입력해 주세요',
  })),
  {
    name: 'a sub-rating out of range',
    body: {
      ...book,
      status: 'done',
      completedDate: '2026-10-01',
      subRatings: { content: 6 },
    },
    error: '내용은(는) 0.5점부터 5점까지 0.5점 단위로 입력해 주세요',
  },
  {
    name: 'a sub-rating criterion of another category',
    body: {
      ...book,
      status: 'done',
      completedDate: '2026-10-01',
      subRatings: { acting: 4 },
    },
    error: '독서 세부 평점에 없는 항목이 있습니다',
  },
  {
    name: 'sub-ratings that are not an object',
    body: { ...book, status: 'done', completedDate: '2026-10-01', subRatings: 4 },
    error: '세부 평점 형식이 올바르지 않습니다',
  },
  {
    name: 'a rating on a wishlist item',
    body: { ...book, rating: 4 },
    error: '완료하지 않은 항목에는 평점을 넣을 수 없습니다',
  },
  {
    name: 'a sub-rating on a wishlist item',
    body: { ...book, subRatings: { content: 4 } },
    error: '완료하지 않은 항목에는 평점을 넣을 수 없습니다',
  },
  {
    name: 'a done item without a completed date',
    body: { ...book, status: 'done' },
    error: '완료한 항목에는 완료일을 입력해 주세요',
  },
  {
    name: 'a wishlist item with a completed date',
    body: { ...book, completedDate: '2026-10-01' },
    error: '완료하지 않은 항목에는 완료일을 넣을 수 없습니다',
  },
  {
    name: 'a completed date after the service date',
    body: { ...book, status: 'done', completedDate: '2026-11-01' },
    error: '완료일은 오늘보다 뒤일 수 없습니다',
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

test('a body that is not valid JSON is a Korean 400', async () => {
  await withApi(untouchedPool(), async (call) => {
    const { status, data } = await call('/api/items', { method: 'POST', rawBody: '{"title":' });
    assert.equal(status, 400);
    assert.deepEqual(data, { error: '요청 본문의 JSON 형식이 올바르지 않습니다' });
  });
});

test('creating an item without a body is a Korean 400', async () => {
  await withApi(untouchedPool(), async (call) => {
    const { status, data } = await call('/api/items', { method: 'POST' });
    assert.equal(status, 400);
    assert.deepEqual(data, { error: '요청 본문이 필요합니다' });
  });
});

// The screen's table in frontend/src/bucket-list.test.tsx must list the same keys.
const criteriaByCategory = {
  reading: { subtype: null, keys: ['content', 'prose', 'afterglow'] },
  screen: { subtype: 'movie', keys: ['story', 'direction', 'acting'] },
  stage: { subtype: 'opera', keys: ['acting', 'direction', 'stage', 'music'] },
  drink: { subtype: 'wine', keys: ['aroma', 'taste', 'finish', 'value'] },
  travel: { subtype: null, keys: ['scenery', 'food', 'lodging', 'transport'] },
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
    assert.deepEqual(data, { error: '항목을 찾을 수 없습니다' });
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
      assert.deepEqual(data, { error: '항목 ID가 올바르지 않습니다' });
    }
    const { status, data } = await call('/api/items/1', { method: 'PATCH', body: {} });
    assert.equal(status, 400);
    assert.deepEqual(data, { error: '수정할 내용이 없습니다' });
  });
});
