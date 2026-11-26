import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

const TODAY = '2026-11-26';

// #210: input that breaks the entry rules is refused before any query reaches the database.
function untouchedPool() {
  const fail = () => {
    throw new Error('The database must not be used for invalid input');
  };
  return { query: fail, connect: fail } as unknown as Pool;
}

const dateMessage = 'Entry date must be a real date in YYYY-MM-DD format';
const refused: {
  name: string;
  method: string;
  path: string;
  body?: unknown;
  rawBody?: string;
  error: string;
}[] = [
  { name: 'a date in the wrong format', method: 'PUT', path: '26-11-2026', error: dateMessage },
  { name: 'a date that does not exist', method: 'PUT', path: '2026-02-30', error: dateMessage },
  { name: 'year zero', method: 'GET', path: '0000-01-01', error: dateMessage },
  { name: 'a bad date on delete', method: 'DELETE', path: 'today', error: dateMessage },
  {
    name: 'a date after today',
    method: 'PUT',
    path: '2026-11-27',
    body: { body: 'Tomorrow' },
    error: 'Entry date cannot be after today',
  },
  {
    name: 'a missing text',
    method: 'PUT',
    path: TODAY,
    body: {},
    error: 'Entry text is required',
  },
  {
    name: 'a text of only spaces and line breaks',
    method: 'PUT',
    path: TODAY,
    body: { body: ' \r\n\n ' },
    error: 'Entry text is required',
  },
  {
    name: 'a text that is not a string',
    method: 'PUT',
    path: TODAY,
    body: { body: ['a'] },
    error: 'Entry text must be text',
  },
  {
    name: 'a text over 10,000 characters',
    method: 'PUT',
    path: TODAY,
    body: { body: 'a'.repeat(10_001) },
    error: 'Entry text must be 10,000 characters or fewer',
  },
  {
    name: 'a NUL character',
    method: 'PUT',
    path: TODAY,
    body: { body: 'a\u0000b' },
    error: 'Entry text contains a character that is not allowed',
  },
  {
    name: 'a title, which entries do not have',
    method: 'PUT',
    path: TODAY,
    body: { body: 'Text', title: 'A title' },
    error: 'The request contains an unknown field',
  },
  {
    name: 'a bad date when listing linked items',
    method: 'GET',
    path: '2026-13-01/items',
    error: dateMessage,
  },
  {
    name: 'a bad date when linking an item',
    method: 'PUT',
    path: '2026-02-30/items/1',
    error: dateMessage,
  },
  {
    name: 'a bad item ID to link',
    method: 'PUT',
    path: `${TODAY}/items/x`,
    error: 'Invalid item ID',
  },
  {
    name: 'a bad item ID to unlink',
    method: 'DELETE',
    path: `${TODAY}/items/0`,
    error: 'Invalid item ID',
  },
  {
    name: 'a page size over 100',
    method: 'GET',
    path: '?limit=101',
    error: 'Page size must be a whole number from 1 to 100',
  },
  {
    name: 'an unknown list filter',
    method: 'GET',
    path: '?from=2026-01-01',
    error: 'The journal request contains an unknown filter',
  },
];

for (const { name, method, path, body, error } of refused) {
  test(`the journal refuses ${name}`, async () => {
    await withApi(
      untouchedPool(),
      async (call) => {
        const url = path.startsWith('?') ? `/api/journal${path}` : `/api/journal/${path}`;
        const { status, data } = await call(url, { method, body });
        assert.equal(status, 400);
        assert.equal(data.error, error);
      },
      { today: () => TODAY },
    );
  });
}

// Exactly 10,000 characters after the line breaks are normalized is allowed; CRLF counts as one.
test('a text of 10,000 characters with CRLF line breaks reaches the database as LF', async () => {
  const saved: unknown[][] = [];
  const pool = {
    query: (_text: string, params: unknown[]) => {
      saved.push(params);
      return Promise.resolve({
        rows: [{ date: TODAY, body: params[1], createdAt: 'x', updatedAt: 'x', created: true }],
      });
    },
  } as unknown as Pool;
  const text = `${'a'.repeat(4_999)}\r\n${'b'.repeat(5_000)}`;
  await withApi(
    pool,
    async (call) => {
      const { status, data } = await call(`/api/journal/${TODAY}`, {
        method: 'PUT',
        body: { body: `  ${text}\r\n` },
      });
      assert.equal(status, 201);
      assert.equal(data.body, `${'a'.repeat(4_999)}\n${'b'.repeat(5_000)}`);
      assert.equal('created' in data, false);
    },
    { today: () => TODAY },
  );
  assert.deepEqual(saved, [[TODAY, `${'a'.repeat(4_999)}\n${'b'.repeat(5_000)}`]]);
});
