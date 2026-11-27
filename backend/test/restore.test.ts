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
  tags: [],
  companions: [],
  created_at: '2026-11-20T01:11:12.123456Z',
  updated_at: '2026-11-20T01:11:12.123456Z',
  ...fields,
});

const quote = (id: number, itemId: number, fields: Record<string, unknown> = {}) => ({
  id,
  item_id: itemId,
  text: `Line ${id}`,
  page: 10,
  note: null,
  created_at: '2026-11-21T01:00:00.000001Z',
  updated_at: '2026-11-21T01:00:00.000001Z',
  ...fields,
});

const log = (id: number, itemId: number, fields: Record<string, unknown> = {}) => ({
  id,
  item_id: itemId,
  logged_on: '2026-11-22',
  rating: 4.5,
  note: null,
  cost_krw: 9000,
  created_at: '2026-11-22T01:00:00Z',
  updated_at: '2026-11-22T01:00:00Z',
  ...fields,
});

const audit = (id: number, fields: Record<string, unknown> = {}) => ({
  id,
  at: '2026-11-23T01:00:00.000009Z',
  actor_type: 'ai-tool',
  actor_id: null,
  client: 'shared-ai',
  tool: 'life_journal__update_item',
  action: 'update',
  entity: 'items',
  entity_id: '1',
  result: 'ok',
  before: { title: 'Old' },
  after: null,
  request_id: null,
  ...fields,
});

const entry = (id: number, date: string, fields: Record<string, unknown> = {}) => ({
  id,
  entry_date: date,
  title: null,
  body: `Day ${id}`,
  created_at: '2026-11-22T14:00:00.000002Z',
  updated_at: '2026-11-22T14:00:00.000002Z',
  ...fields,
});

const link = (entryId: number, itemId: number, fields: Record<string, unknown> = {}) => ({
  entry_id: entryId,
  item_id: itemId,
  linked_at: '2026-11-22T14:05:00.000003Z',
  ...fields,
});

const notionPage = (id: number, fields: Record<string, unknown> = {}) => ({
  id,
  notion_id: `page${id}`,
  parent_notion_id: null,
  kind: 'page',
  title: 'Travel',
  body: '# Travel',
  path: 'Travel',
  notion_edited_at: '2026-11-20T00:00:00.000000Z',
  imported_at: '2026-11-27T01:00:00.000000Z',
  deleted_at: null,
  ...fields,
});

const essay = (id: number, fields: Record<string, unknown> = {}) => ({
  id,
  title: 'On wine',
  body: 'Notes',
  written_date: '2026-11-20',
  status: 'draft',
  tags: ['wine'],
  created_at: '2026-11-20T01:00:00.000000Z',
  updated_at: '2026-11-20T01:00:00.000000Z',
  ...fields,
});

const exportFile = (tables: Record<string, unknown[]> = {}) => ({
  format: 'life-journal-export',
  version: 1,
  exportedAt: '2026-11-26T09:00:00.000+09:00',
  tables: {
    items: [item(1), item(2, { category: 'drink', status: 'done', completed_date: '2026-11-22' })],
    item_quotes: [quote(1, 1)],
    item_logs: [log(1, 2), log(2, 2)],
    learned_terms: [{ term_id: 'wine-tannin', learned_at: '2026-11-20T00:00:00.000004Z' }],
    journal_entries: [entry(1, '2026-11-22', { title: 'A day' })],
    journal_entry_items: [link(1, 2)],
    audit_log: [audit(1)],
    notion_pages: [notionPage(1)],
    essays: [essay(1)],
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
    assert.deepEqual(data, {
      restored: {
        items: 2,
        item_quotes: 1,
        item_logs: 2,
        learned_terms: 1,
        audit_log: 1,
        journal_entries: 1,
        journal_entry_items: 1,
        notion_pages: 1,
        essays: 1,
      },
    });
  });
  assert.deepEqual(asked, [
    'BEGIN',
    'LOCK TABLE items,',
    'DELETE FROM journal_entry_items',
    'DELETE FROM journal_entries',
    'DELETE FROM item_logs',
    'DELETE FROM item_quotes',
    'DELETE FROM learned_terms',
    'DELETE FROM items',
    'DELETE FROM audit_log',
    'DELETE FROM notion_pages',
    'DELETE FROM essays',
    'INSERT INTO items',
    'INSERT INTO item_quotes',
    'INSERT INTO item_logs',
    'INSERT INTO learned_terms',
    'INSERT INTO journal_entries',
    'INSERT INTO journal_entry_items',
    'INSERT INTO audit_log',
    'INSERT INTO notion_pages',
    'INSERT INTO essays',
    "SELECT setval(pg_get_serial_sequence('items', 'id'),",
    "SELECT setval(pg_get_serial_sequence('item_quotes', 'id'),",
    "SELECT setval(pg_get_serial_sequence('item_logs', 'id'),",
    "SELECT setval(pg_get_serial_sequence('journal_entries', 'id'),",
    "SELECT setval(pg_get_serial_sequence('audit_log', 'id'),",
    "SELECT setval(pg_get_serial_sequence('notion_pages', 'id'),",
    "SELECT setval(pg_get_serial_sequence('essays', 'id'),",
    'COMMIT',
    'release',
  ]);
});

test('a version-1 file from before quotes, logs, and the audit log restores with none of them', async () => {
  const { pool } = fakePool();
  const older = exportFile();
  const {
    item_quotes: _quotes,
    item_logs: _logs,
    audit_log: _audit,
    journal_entries: _entries,
    journal_entry_items: _links,
    notion_pages: _pages,
    essays: _essays,
    ...tables
  } = older.tables;
  await withApi(createApp(pool), async (call) => {
    const { status, data } = await call('/api/restore', {
      method: 'POST',
      body: { ...older, tables },
    });
    assert.equal(status, 200);
    assert.deepEqual(data, {
      restored: {
        items: 2,
        item_quotes: 0,
        item_logs: 0,
        learned_terms: 1,
        audit_log: 0,
        journal_entries: 0,
        journal_entry_items: 0,
        notion_pages: 0,
        essays: 0,
      },
    });
  });
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
    'tags that are not a list of names',
    exportFile({ items: [item(1, { tags: 'birthday' })] }),
    /tables\.items\.0\.tags/,
    'tables.items.0.tags',
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
  [
    'an empty quote',
    exportFile({ item_quotes: [quote(1, 1, { text: ' ' })] }),
    /tables\.item_quotes\.0\.text: Quote must not be empty/,
    'tables.item_quotes.0.text',
  ],
  [
    'the same quote id twice',
    exportFile({ item_quotes: [quote(3, 1), quote(3, 1)] }),
    /tables\.item_quotes\.1: Duplicate key 3/,
    'tables.item_quotes.1',
  ],
  [
    'a quote of an item that is not a book',
    exportFile({ item_quotes: [quote(1, 2)] }),
    /tables\.item_quotes\.0\.item_id: Quotes only on reading items, not drink/,
    'tables.item_quotes.0.item_id',
  ],
  [
    'a log of an item missing from the file',
    exportFile({ item_logs: [log(1, 99)] }),
    /tables\.item_logs\.0\.item_id: Item 99 is not in the file/,
    'tables.item_logs.0.item_id',
  ],
  [
    'a log of a category without logs',
    exportFile({ item_logs: [log(1, 1)] }),
    /Logs only on drink, travel items, not reading/,
    'tables.item_logs.0.item_id',
  ],
  [
    'a log without its date',
    exportFile({ item_logs: [log(1, 2, { logged_on: null })] }),
    /tables\.item_logs\.0\.logged_on/,
    'tables.item_logs.0.logged_on',
  ],
  [
    'an audit row of an unknown actor',
    exportFile({ audit_log: [audit(1, { actor_type: 'robot' })] }),
    /tables\.audit_log\.0\.actor_type/,
    'tables.audit_log.0.actor_type',
  ],
  [
    'an audit row without its before snapshot',
    exportFile({ audit_log: [(({ before: _before, ...row }) => row)(audit(1))] }),
    /tables\.audit_log\.0\.before/,
    'tables.audit_log.0.before',
  ],
  [
    'two entries on one date',
    exportFile({ journal_entries: [entry(1, '2026-11-22'), entry(2, '2026-11-22')] }),
    /tables\.journal_entries\.1: Duplicate key 2026-11-22/,
    'tables.journal_entries.1',
  ],
  [
    'an empty entry',
    exportFile({ journal_entries: [entry(1, '2026-11-22', { body: ' ' })] }),
    /tables\.journal_entries\.0\.body: Entry must not be empty/,
    'tables.journal_entries.0.body',
  ],
  [
    'a link of an entry missing from the file',
    exportFile({ journal_entry_items: [link(9, 2)] }),
    /tables\.journal_entry_items\.0: Entry 9 is not in the file/,
    'tables.journal_entry_items.0',
  ],
  [
    'a link of an item missing from the file',
    exportFile({ journal_entry_items: [link(1, 99)] }),
    /tables\.journal_entry_items\.0: Item 99 is not in the file/,
    'tables.journal_entry_items.0',
  ],
  [
    'a link of an item completed on another day',
    exportFile({ journal_entry_items: [link(1, 1)] }),
    /tables\.journal_entry_items\.0: Item 1 was not completed on 2026-11-22/,
    'tables.journal_entry_items.0',
  ],
  [
    'the same link twice',
    exportFile({ journal_entry_items: [link(1, 2), link(1, 2)] }),
    /tables\.journal_entry_items\.1: Duplicate key 1-2/,
    'tables.journal_entry_items.1',
  ],
  [
    'the same audit id twice',
    exportFile({ audit_log: [audit(5), audit(5)] }),
    /tables\.audit_log\.1: Duplicate key 5/,
    'tables.audit_log.1',
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
  const body = exportFile({
    items: many,
    item_logs: [],
    journal_entries: [],
    journal_entry_items: [],
  });
  assert.ok(JSON.stringify(body).length > 256 * 1024);
  const { pool } = fakePool();
  await withApi(createApp(pool), async (call) => {
    const restore = await call('/api/restore', { method: 'POST', body });
    assert.equal(restore.status, 200);
    assert.deepEqual(restore.data, {
      restored: {
        items: 1500,
        item_quotes: 1,
        item_logs: 0,
        learned_terms: 1,
        audit_log: 1,
        journal_entries: 0,
        journal_entry_items: 0,
        notion_pages: 1,
        essays: 1,
      },
    });
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
