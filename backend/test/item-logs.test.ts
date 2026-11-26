import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

const TODAY = '2026-10-31';

// Invalid input must be rejected before any query reaches the database.
function untouchedPool() {
  const fail = () => {
    throw new Error('The database must not be used for invalid input');
  };
  return { query: fail, connect: fail } as unknown as Pool;
}

const log = { date: '2026-10-01' };
const ratingError = 'Rating must be from 0.5 to 5 in steps of 0.5';
const dateError = 'Date must be a real date in YYYY-MM-DD format';
const costError = 'Cost must be a whole number of won, 0 or more';

for (const [name, body, error] of [
  ['no body', undefined, 'Request body is required'],
  ['a missing date', { rating: 4 }, dateError],
  ['a date that does not exist', { date: '2026-02-30' }, dateError],
  ['a date in another format', { date: '2026/10/01' }, dateError],
  ['a date after today', { date: '2026-11-01' }, 'Date cannot be after today'],
  ['rating 0', { ...log, rating: 0 }, ratingError],
  ['rating 5.5', { ...log, rating: 5.5 }, ratingError],
  ['rating 4.3', { ...log, rating: 4.3 }, ratingError],
  ['a rating given as text', { ...log, rating: '4' }, ratingError],
  [
    'a note over 500 characters',
    { ...log, note: 'x'.repeat(501) },
    'Note must be 500 characters or fewer',
  ],
  ['a note that is not text', { ...log, note: 1 }, 'Note must be text'],
  ['a NUL in the note', { ...log, note: '맛\0' }, 'Note contains a character that is not allowed'],
  ['a negative cost', { ...log, costKrw: -1 }, costError],
  ['a fractional cost', { ...log, costKrw: 1.5 }, costError],
  ['a cost over the column', { ...log, costKrw: 2 ** 31 }, 'Cost must be 2147483647 won or less'],
  ['an unknown field', { ...log, place: '서울' }, 'The request contains an unknown field'],
] as const) {
  test(`adding a log with ${name} is a 400`, async () => {
    await withApi(
      untouchedPool(),
      async (call) => {
        const { status, data } = await call('/api/items/1/logs', { method: 'POST', body });
        assert.equal(status, 400);
        assert.deepEqual(data, { error });
      },
      { today: () => TODAY },
    );
  });
}

test('malformed ids, empty patches, and bad patch values are 400s', async () => {
  await withApi(
    untouchedPool(),
    async (call) => {
      for (const [path, init, error] of [
        ['/api/items/abc/logs', { method: 'GET' }, 'Invalid item ID'],
        ['/api/items/0/logs', { method: 'POST', body: log }, 'Invalid item ID'],
        ['/api/items/1/logs/x', { method: 'PATCH', body: log }, 'Invalid log ID'],
        ['/api/items/1/logs/1.5', { method: 'DELETE' }, 'Invalid log ID'],
        ['/api/items/1/logs/1', { method: 'PATCH', body: {} }, 'Nothing to update'],
        ['/api/items/1/logs/1', { method: 'PATCH', body: { date: null } }, dateError],
        [
          '/api/items/1/logs/1',
          { method: 'PATCH', body: { date: '2026-11-01' } },
          'Date cannot be after today',
        ],
        ['/api/items/1/logs/1', { method: 'PATCH', body: { rating: 6 } }, ratingError],
      ] as const) {
        const { status, data } = await call(path, init);
        assert.equal(status, 400, `${init.method} ${path}`);
        assert.deepEqual(data, { error });
      }
    },
    { today: () => TODAY },
  );
});

test('a log on today is allowed, its note is trimmed with \\n line ends, and blanks are null', async () => {
  const params: unknown[][] = [];
  const client = {
    on: () => {},
    off: () => {},
    release: () => {},
    query: async (sql: string, values: unknown[] = []) => {
      if (sql.startsWith('SELECT category')) return { rows: [{ category: 'drink' }] };
      if (sql.startsWith('INSERT')) params.push(values);
      return { rows: [{ id: 1 }] };
    },
  };
  const pool = { connect: async () => client } as unknown as Pool;
  await withApi(
    pool,
    async (call) => {
      for (const body of [
        { date: TODAY, rating: 4.5, note: '  첫 잔\r\n둘째 잔  ', costKrw: 18000 },
        { date: TODAY, note: '   ', rating: null, costKrw: null },
      ]) {
        const { status } = await call('/api/items/7/logs', { method: 'POST', body });
        assert.equal(status, 201);
      }
    },
    { today: () => TODAY },
  );
  assert.deepEqual(params, [
    [7, TODAY, 4.5, '첫 잔\n둘째 잔', 18000],
    [7, TODAY, null, null, null],
  ]);
});

test('a patch sets only the fields it names, by their column names', async () => {
  const calls: { sql: string; values: unknown[] }[] = [];
  const pool = {
    query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      return { rows: [{ id: 3 }], rowCount: 1 };
    },
  } as unknown as Pool;
  await withApi(
    pool,
    async (call) => {
      const { status } = await call('/api/items/7/logs/3', {
        method: 'PATCH',
        body: { costKrw: 0, date: '2026-10-02', note: null },
      });
      assert.equal(status, 200);
    },
    { today: () => TODAY },
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /SET logged_on = \$3, note = \$4, cost_krw = \$5,\s+updated_at/);
  assert.deepEqual(calls[0].values, [3, 7, '2026-10-02', null, 0]);
});
