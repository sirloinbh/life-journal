import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { createApp } from '../src/app.js';
import { withApi } from './standard/api.js';

const item = (id: number, fields: Record<string, unknown> = {}) => ({
  id,
  category: 'reading',
  subtype: null,
  title: `Book ${id}`,
  status: 'wishlist',
  cost_krw: null,
  planned_date: null,
  completed_date: null,
  details: {},
  rating: null,
  sub_ratings: {},
  review: null,
  link: null,
  created_at: '2026-11-20T01:11:12.123456Z',
  updated_at: '2026-11-20T01:11:12.123456Z',
  ...fields,
});

const exportFile = (tables: Record<string, unknown[]> = {}) => ({
  format: 'life-journal-export',
  version: 1,
  exportedAt: '2026-11-26T09:00:00.000+09:00',
  tables: {
    items: [item(1), item(2)],
    learned_terms: [{ term_id: 'wine-tannin', learned_at: '2026-11-20T00:00:00.000004Z' }],
    ...tables,
  },
});

// A pool that records the restore's statements. `fail` makes the first INSERT fail like a CHECK would.
function fakePool(fail?: { code: string; constraint?: string }) {
  const asked: string[] = [];
  const client = {
    query: async (sql: string) => {
      const first = sql.trim().split(/\s+/).slice(0, 3).join(' ');
      asked.push(first);
      if (fail && first.startsWith('INSERT INTO items')) throw Object.assign(new Error('x'), fail);
      return { rows: [] };
    },
    release: () => asked.push('release'),
  };
  return { pool: { connect: async () => client } as unknown as Pool, asked };
}

const noDatabase = {
  connect: () => Promise.reject(new Error('No database call is expected')),
  query: () => Promise.reject(new Error('No database call is expected')),
} as unknown as Pool;

test('a valid file replaces every record in one transaction and answers the counts', async () => {
  const { pool, asked } = fakePool();
  await withApi(createApp(pool), async (call) => {
    const { status, data } = await call('/api/restore', { method: 'POST', body: exportFile() });
    assert.equal(status, 200);
    assert.deepEqual(data, { restored: { items: 2, learned_terms: 1 } });
  });
  assert.deepEqual(asked, [
    'BEGIN',
    'LOCK TABLE items,',
    'DELETE FROM learned_terms',
    'DELETE FROM items',
    'INSERT INTO items',
    'INSERT INTO learned_terms',
    "SELECT setval(pg_get_serial_sequence('items', 'id'),",
    'COMMIT',
    'release',
  ]);
});

const refused: [string, unknown, RegExp, string][] = [
  [
    'another file',
    { ...exportFile(), format: 'something-else' },
    /not a life-journal export file/,
    'format',
  ],
  ['a newer version', { ...exportFile(), version: 2 }, /restores export version 1 only/, 'version'],
  [
    'a missing table',
    { ...exportFile(), tables: { items: [] } },
    /tables\.learned_terms/,
    'tables.learned_terms',
  ],
  ['an unknown table', exportFile({ photos: [] }), /tables/, 'tables'],
  [
    'an unknown column',
    exportFile({ items: [item(1, { mood: 'happy' })] }),
    /tables\.items\.0/,
    'tables.items.0',
  ],
  [
    'an empty title in one row',
    exportFile({ items: [item(1), item(2), item(3, { title: '  ' })] }),
    /tables\.items\.2\.title: Title must not be empty/,
    'tables.items.2.title',
  ],
  [
    'a time without its zone',
    exportFile({ items: [item(1, { created_at: '2026-11-20 10:00:00' })] }),
    /tables\.items\.0\.created_at: Use a UTC time/,
    'tables.items.0.created_at',
  ],
  [
    'the same id twice',
    exportFile({ items: [item(4), item(4)] }),
    /tables\.items\.1: Duplicate key 4/,
    'tables.items.1',
  ],
  [
    'the same term twice',
    exportFile({
      learned_terms: [
        { term_id: 'a', learned_at: '2026-11-20T00:00:00Z' },
        { term_id: 'a', learned_at: '2026-11-21T00:00:00Z' },
      ],
    }),
    /Duplicate key a/,
    'tables.learned_terms.1',
  ],
];

for (const [name, body, message, path] of refused) {
  test(`a file with ${name} is refused before the database is touched`, async () => {
    await withApi(createApp(noDatabase), async (call) => {
      const { status, data } = await call('/api/restore', { method: 'POST', body });
      assert.equal(status, 400);
      assert.match(String(data.error), /^The file was not restored\. /);
      assert.match(String(data.error), message);
      assert.ok(
        (data.fields as { path: string }[]).some((field) => field.path === path),
        JSON.stringify(data.fields),
      );
    });
  });
}

test('a row the database refuses is a 400 that names the rule, after a rollback', async () => {
  const { pool, asked } = fakePool({ code: '23514', constraint: 'items_rating_check' });
  await withApi(createApp(pool), async (call) => {
    const { status, data } = await call('/api/restore', { method: 'POST', body: exportFile() });
    assert.equal(status, 400);
    assert.equal(
      data.error,
      'The file was not restored. A row breaks a database rule (items_rating_check)',
    );
  });
  assert.deepEqual(asked.slice(-2), ['ROLLBACK', 'release']);
  assert.ok(!asked.includes('COMMIT'));
});

test('a restore file larger than 256 kB is read, while other routes keep their limit', async () => {
  const many = Array.from({ length: 1500 }, (_, index) =>
    item(index + 1, { review: null, details: { note: 'x'.repeat(200) } }),
  );
  const body = exportFile({ items: many });
  assert.ok(JSON.stringify(body).length > 256 * 1024);
  const { pool } = fakePool();
  await withApi(createApp(pool), async (call) => {
    const restore = await call('/api/restore', { method: 'POST', body });
    assert.equal(restore.status, 200);
    assert.deepEqual(restore.data, { restored: { items: 1500, learned_terms: 1 } });
    const other = await call('/api/items', {
      method: 'POST',
      body: { title: 'x'.repeat(300 * 1024) },
    });
    assert.equal(other.status, 413);
  });
});

test('a restore file over 20 MB is refused as too large', async () => {
  await withApi(createApp(noDatabase), async (call) => {
    const { status } = await call('/api/restore', {
      method: 'POST',
      rawBody: `{"pad":"${'x'.repeat(21 * 1024 * 1024)}"}`,
      contentType: 'application/json',
    });
    assert.equal(status, 413);
  });
});

test('a restore needs the sign-in like every other route', async () => {
  const deny: Parameters<typeof createApp>[1] = {
    auth: (_req, res) => void res.status(401).json({ error: 'Sign in first' }),
  };
  await withApi(createApp(noDatabase, deny), async (call) => {
    const { status } = await call('/api/restore', { method: 'POST', body: exportFile() });
    assert.equal(status, 401);
  });
});
