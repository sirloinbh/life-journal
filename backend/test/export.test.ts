import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { createApp } from '../src/app.js';
import { EXPORT_TABLES, seoulTime, toCsv } from '../src/export.js';
import { parseCsv } from './csv.js';
import { withApi } from './standard/api.js';

test('CSV keeps commas, quotes, line breaks, empty text, and null apart', () => {
  const rows = [
    {
      id: 1,
      title: 'Hello, "world"',
      review: 'line one\nline two\r\nline three',
      subtype: '',
      details: { author: '한강, "작가"' },
      rating: 4.5,
      link: null,
    },
  ];
  const columns = ['id', 'title', 'review', 'subtype', 'details', 'rating', 'link'];
  const [header, values] = parseCsv(toCsv(columns, rows));
  assert.deepEqual(header, columns);
  assert.deepEqual(values, [
    '1',
    'Hello, "world"',
    'line one\nline two\r\nline three',
    '',
    '{"author":"한강, \\"작가\\""}',
    '4.5',
    null,
  ]);
  assert.deepEqual(JSON.parse(values[4]!), { author: '한강, "작가"' });
});

test('the export time is written in Asia/Seoul with its offset', () => {
  assert.equal(seoulTime(new Date('2026-11-25T15:30:00.250Z')), '2026-11-26T00:30:00.250+09:00');
});

// A pool that answers the export's queries from fixed rows and records what was asked.
function fakePool(rows: Record<string, Record<string, unknown>[]>) {
  const asked: string[] = [];
  const client = {
    query: async (sql: string) => {
      const table = Object.entries(EXPORT_TABLES).find(([, { sql: text }]) => text === sql);
      asked.push(table ? `read ${table[0]}` : sql);
      if (table) return { rows: rows[table[0]] };
      return { rows: [] };
    },
    release: () => asked.push('release'),
  };
  return { pool: { connect: async () => client } as unknown as Pool, asked };
}

const item = {
  id: 7,
  category: 'reading',
  subtype: null,
  title: 'A, "B"',
  status: 'wishlist',
  cost_krw: null,
  planned_date: '2026-12-01',
  completed_date: null,
  details: { author: 'Kim' },
  rating: null,
  sub_ratings: {},
  review: null,
  link: null,
  tags: ['gift', 'a, "b"'],
  companions: [],
  created_at: '2026-11-26T00:00:00.123456Z',
  updated_at: '2026-11-26T00:00:00.123456Z',
};

const quote = {
  id: 3,
  item_id: 7,
  text: '"A line", with a comma',
  page: 12,
  note: null,
  created_at: '2026-11-26T00:00:01.000001Z',
  updated_at: '2026-11-26T00:00:01.000001Z',
};

const audit = {
  id: 9,
  at: '2026-11-26T00:00:03.000003Z',
  actor_type: 'ai-tool',
  actor_id: null,
  client: 'shared-ai',
  tool: 'life_journal__list_items',
  action: 'read',
  entity: 'items',
  entity_id: null,
  result: 'ok',
  before: null,
  after: { count: 1 },
  request_id: 'req-1',
};

const log = {
  id: 5,
  item_id: 7,
  logged_on: '2026-11-20',
  rating: 3.5,
  note: 'Second visit',
  cost_krw: 12000,
  created_at: '2026-11-26T00:00:02.000002Z',
  updated_at: '2026-11-26T00:00:02.000002Z',
};

test('GET /api/export answers a dated JSON download of every table from one snapshot', async () => {
  const journalEntry = {
    id: 1,
    entry_date: '2026-11-02',
    title: null,
    body: 'A day',
    created_at: '2026-11-02T14:00:00.000000Z',
    updated_at: '2026-11-02T14:00:00.000000Z',
  };
  const journalLink = { entry_id: 1, item_id: 1, linked_at: '2026-11-02T14:05:00.000000Z' };
  const notionPage = {
    id: 1,
    notion_id: 'aaa',
    parent_notion_id: null,
    kind: 'page',
    title: 'Travel',
    body: '# Travel',
    path: 'Travel',
    notion_edited_at: '2026-11-20T00:00:00.000000Z',
    imported_at: '2026-11-27T01:00:00.000000Z',
    deleted_at: null,
  };
  const essay = {
    id: 1,
    title: 'On wine',
    body: 'Notes',
    written_date: '2026-11-20',
    status: 'draft',
    tags: ['wine'],
    created_at: '2026-11-20T01:00:00.000000Z',
    updated_at: '2026-11-20T01:00:00.000000Z',
  };
  const { pool, asked } = fakePool({
    items: [item],
    item_quotes: [quote],
    item_logs: [log],
    learned_terms: [{ term_id: 'wine-tannin', learned_at: '2026-11-20T01:02:03.000004Z' }],
    journal_entries: [journalEntry],
    journal_entry_items: [journalLink],
    notion_pages: [notionPage],
    essays: [essay],
    audit_log: [audit],
  });
  await withApi(createApp(pool, { today: () => '2026-11-26' }), async (call) => {
    const { status, data, headers } = await call('/api/export');
    assert.equal(status, 200);
    assert.equal(
      headers.get('content-disposition'),
      'attachment; filename=life-journal-2026-11-26.json',
    );
    assert.match(String(headers.get('content-type')), /^application\/json/);
    assert.equal(headers.get('cache-control'), 'no-store');
    assert.equal(data.format, 'life-journal-export');
    assert.equal(data.version, 1);
    assert.match(String(data.exportedAt), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+09:00$/);
    assert.deepEqual(data.tables, {
      items: [item],
      item_quotes: [quote],
      item_logs: [log],
      learned_terms: [{ term_id: 'wine-tannin', learned_at: '2026-11-20T01:02:03.000004Z' }],
      journal_entries: [journalEntry],
      journal_entry_items: [journalLink],
      notion_pages: [notionPage],
      essays: [essay],
      audit_log: [audit],
    });
  });
  assert.deepEqual(asked, [
    'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
    'read items',
    'read item_quotes',
    'read item_logs',
    'read learned_terms',
    'read journal_entries',
    'read journal_entry_items',
    'read notion_pages',
    'read essays',
    'read audit_log',
    'COMMIT',
    'release',
  ]);
});

test('GET /api/export/items.csv answers a dated CSV download of the items', async () => {
  const { pool } = fakePool({
    items: [item],
    item_quotes: [],
    item_logs: [],
    learned_terms: [],
    audit_log: [],
  });
  await withApi(createApp(pool, { today: () => '2026-11-26' }), async (call) => {
    const { status, headers, bytes } = await call('/api/export/items.csv');
    assert.equal(status, 200);
    assert.equal(
      headers.get('content-disposition'),
      'attachment; filename=life-journal-items-2026-11-26.csv',
    );
    assert.equal(headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.equal(headers.get('cache-control'), 'no-store');
    const [header, values] = parseCsv(bytes.toString('utf8'));
    assert.deepEqual(header, EXPORT_TABLES.items.columns);
    assert.equal(values[header.indexOf('title')], 'A, "B"');
    assert.equal(values[header.indexOf('details')], '{"author":"Kim"}');
    assert.equal(values[header.indexOf('sub_ratings')], '{}');
    assert.deepEqual(JSON.parse(values[header.indexOf('tags')]!), ['gift', 'a, "b"']);
    assert.equal(values[header.indexOf('companions')], '[]');
    assert.equal(values[header.indexOf('review')], null);
  });
});
