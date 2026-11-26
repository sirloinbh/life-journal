import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

// Invalid input must be rejected before any query reaches the database.
function untouchedPool() {
  const fail = () => {
    throw new Error('The database must not be used for invalid input');
  };
  return { query: fail, connect: fail } as unknown as Pool;
}

const quote = { text: '새는 알에서 나오려고 투쟁한다.' };

for (const [name, body, error] of [
  ['no body', undefined, 'Request body is required'],
  ['a missing text', { page: 3 }, 'Quote is required'],
  ['a blank text', { text: ' \n ' }, 'Quote is required'],
  ['a text that is not text', { text: 5 }, 'Quote must be text'],
  [
    'a text over 1,000 characters',
    { text: '가'.repeat(1001) },
    'Quote must be 1000 characters or fewer',
  ],
  ['a NUL in the text', { text: '알\0' }, 'Quote contains a character that is not allowed'],
  ['page 0', { ...quote, page: 0 }, 'Page must be a whole number from 1 to 99999'],
  ['a fractional page', { ...quote, page: 1.5 }, 'Page must be a whole number from 1 to 99999'],
  ['a page given as text', { ...quote, page: '3' }, 'Page must be a whole number from 1 to 99999'],
  ['page 100000', { ...quote, page: 100000 }, 'Page must be a whole number from 1 to 99999'],
  [
    'a note over 500 characters',
    { ...quote, note: 'x'.repeat(501) },
    'Note must be 500 characters or fewer',
  ],
  ['a note that is not text', { ...quote, note: 1 }, 'Note must be text'],
  ['an unknown field', { ...quote, chapter: 2 }, 'The request contains an unknown field'],
] as const) {
  test(`adding a quote with ${name} is a 400`, async () => {
    await withApi(untouchedPool(), async (call) => {
      const { status, data } = await call('/api/items/1/quotes', { method: 'POST', body });
      assert.equal(status, 400);
      assert.deepEqual(data, { error });
    });
  });
}

test('malformed ids and empty quote patches are 400s', async () => {
  await withApi(untouchedPool(), async (call) => {
    for (const [path, init, error] of [
      ['/api/items/abc/quotes', { method: 'GET' }, 'Invalid item ID'],
      ['/api/items/0/quotes', { method: 'POST', body: quote }, 'Invalid item ID'],
      ['/api/items/1/quotes/x', { method: 'PATCH', body: quote }, 'Invalid quote ID'],
      ['/api/items/1/quotes/1.5', { method: 'DELETE' }, 'Invalid quote ID'],
      ['/api/items/1/quotes/1', { method: 'PATCH', body: {} }, 'Nothing to update'],
    ] as const) {
      const { status, data } = await call(path, init);
      assert.equal(status, 400, `${init.method} ${path}`);
      assert.deepEqual(data, { error });
    }
  });
});

test('the text is trimmed with Windows line ends as \\n, and a blank note is no note', async () => {
  const params: unknown[][] = [];
  const client = {
    on: () => {},
    off: () => {},
    release: () => {},
    query: async (sql: string, values: unknown[] = []) => {
      if (sql.startsWith('SELECT category')) return { rows: [{ category: 'reading' }] };
      if (sql.startsWith('INSERT')) params.push(values);
      return { rows: [{ id: 1 }] };
    },
  };
  const pool = { connect: async () => client } as unknown as Pool;
  await withApi(pool, async (call) => {
    const { status } = await call('/api/items/7/quotes', {
      method: 'POST',
      body: { text: '  첫 줄\r\n둘째 줄  ', page: 12, note: '   ' },
    });
    assert.equal(status, 201);
  });
  assert.deepEqual(params, [[7, '첫 줄\n둘째 줄', 12, null]]);
});
