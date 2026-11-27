import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXPORT_TABLES, readExport, toCsv } from '../src/export.js';
import { parseCsv } from './csv.js';
import { testPool } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

// The rows are written and read inside one transaction that is rolled back, so other test files that
// clear the tables at the same time cannot change what this test sees, and nothing is left behind.
test(
  'an export of a seeded database holds every item, quote, log, learned term, and audit row with all fields',
  { skip: !url },
  async (t) => {
    const pool = testPool();
    t.after(() => pool.end());
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Other test files write these tables at the same time; the lock makes them wait until the
      // rollback, so every statement here sees the same rows. Reads still go through.
      await client.query(
        `LOCK TABLE items, item_quotes, item_logs, learned_terms, audit_log, journal_entries,
           journal_entry_items IN EXCLUSIVE MODE`,
      );
      const { rows: inserted } = await client.query<{ id: number }>(
        `INSERT INTO items (category, subtype, title, status, cost_krw, planned_date, completed_date,
           details, rating, sub_ratings, review, link, tags, companions, created_at, updated_at)
         VALUES
           ('reading', NULL, 'Wish, with "quotes"', 'wishlist', NULL, '2026-12-24', NULL,
            '{"author": "한강"}', NULL, '{}', NULL, NULL, '{}', '{}',
            '2026-11-20 10:11:12.123456+09', '2026-11-21 00:00:00.000001+09'),
           ('stage', 'musical', 'Done
 on two lines', 'done', 150000, NULL, '2026-11-02',
            '{"venue": "Seoul, Arts Center"}', 4.5, '{"story": 4, "music": 5}',
            'Line one, "quoted"
Line two', 'https://example.com/a?b=c,d', ARRAY['birthday', 'with "quotes", comma'], ARRAY['민지'],
            '2026-11-02 21:00:00+09', '2026-11-03 08:30:00.5+09')
         RETURNING id`,
      );
      const {
        rows: [quote],
      } = await client.query<{ id: number }>(
        `INSERT INTO item_quotes (item_id, text, page, note, created_at, updated_at)
         VALUES ($1, 'First line, "quoted"
second line', 12, NULL, '2026-11-20 10:00:00.000007+09', '2026-11-20 10:00:00.000007+09')
         RETURNING id`,
        [inserted[0].id],
      );
      const {
        rows: [log],
      } = await client.query<{ id: number }>(
        `INSERT INTO item_logs (item_id, logged_on, rating, note, cost_krw, created_at, updated_at)
         VALUES ($1, '2026-11-10', 3.5, '두 번째 관람', 90000, '2026-11-10 22:00:00+09', '2026-11-11 08:00:00.25+09')
         RETURNING id`,
        [inserted[1].id],
      );
      await client.query(
        `INSERT INTO learned_terms (term_id, learned_at) VALUES
           ('wine-tannin', '2026-11-20 09:00:00.000004+09'), ('opera-aria', '2026-11-21 09:00:00+09')
         ON CONFLICT (term_id) DO UPDATE SET learned_at = EXCLUDED.learned_at`,
      );
      const {
        rows: [entry],
      } = await client.query<{ id: number }>(
        `INSERT INTO journal_entries (entry_date, title, body, created_at, updated_at)
         VALUES ('2026-11-02', '뮤지컬, "본 날"', E'첫 줄
둘째 줄', '2026-11-02 23:00:00.000005+09', '2026-11-03 08:00:00.5+09')
         RETURNING id`,
      );
      await client.query(
        `INSERT INTO journal_entry_items (entry_id, item_id, linked_at)
         VALUES ($1, $2, '2026-11-02 23:05:00.000003+09')`,
        [entry!.id, inserted[1].id],
      );
      const {
        rows: [audit],
      } = await client.query<{ id: number }>(
        `INSERT INTO audit_log (at, actor_type, actor_id, client, tool, action, entity, entity_id,
           result, before, after, request_id)
         VALUES ('2026-11-25 23:59:59.000009+09', 'ai-tool', NULL, 'shared-ai', 'life_journal__update_item',
           'update', 'items', $1, 'ok', '{"title": "옛 제목, \\"a\\""}', '{"title": "New"}', 'req-7')
         RETURNING id`,
        [String(inserted[0].id)],
      );

      const file = await readExport(client, new Date('2026-11-26T00:00:00Z'));
      assert.equal(file.format, 'life-journal-export');
      assert.equal(file.version, 1);
      assert.equal(file.exportedAt, '2026-11-26T09:00:00.000+09:00');

      // Every row, not only the seeded ones.
      for (const table of [
        'items',
        'item_quotes',
        'item_logs',
        'learned_terms',
        'journal_entries',
        'journal_entry_items',
        'audit_log',
      ] as const) {
        const { rows } = await client.query<{ total: number }>(
          `SELECT count(*)::int AS total FROM ${table}`,
        );
        assert.equal(file.tables[table].length, rows[0].total, table);
      }

      const [wish, done] = inserted.map(({ id }) => file.tables.items.find((row) => row.id === id));
      assert.deepEqual(wish, {
        id: inserted[0].id,
        category: 'reading',
        subtype: null,
        title: 'Wish, with "quotes"',
        status: 'wishlist',
        cost_krw: null,
        planned_date: '2026-12-24',
        completed_date: null,
        details: { author: '한강' },
        rating: null,
        sub_ratings: {},
        review: null,
        link: null,
        tags: [],
        companions: [],
        created_at: '2026-11-20T01:11:12.123456Z',
        updated_at: '2026-11-20T15:00:00.000001Z',
      });
      assert.deepEqual(done, {
        id: inserted[1].id,
        category: 'stage',
        subtype: 'musical',
        title: 'Done\n on two lines',
        status: 'done',
        cost_krw: 150000,
        planned_date: null,
        completed_date: '2026-11-02',
        details: { venue: 'Seoul, Arts Center' },
        rating: 4.5,
        sub_ratings: { story: 4, music: 5 },
        review: 'Line one, "quoted"\nLine two',
        link: 'https://example.com/a?b=c,d',
        tags: ['birthday', 'with "quotes", comma'],
        companions: ['민지'],
        created_at: '2026-11-02T12:00:00.000000Z',
        updated_at: '2026-11-02T23:30:00.500000Z',
      });
      assert.deepEqual(
        file.tables.item_quotes.find((row) => row.id === quote!.id),
        {
          id: quote!.id,
          item_id: inserted[0].id,
          text: 'First line, "quoted"\nsecond line',
          page: 12,
          note: null,
          created_at: '2026-11-20T01:00:00.000007Z',
          updated_at: '2026-11-20T01:00:00.000007Z',
        },
      );
      assert.deepEqual(
        file.tables.item_logs.find((row) => row.id === log!.id),
        {
          id: log!.id,
          item_id: inserted[1].id,
          logged_on: '2026-11-10',
          rating: 3.5,
          note: '두 번째 관람',
          cost_krw: 90000,
          created_at: '2026-11-10T13:00:00.000000Z',
          updated_at: '2026-11-10T23:00:00.250000Z',
        },
      );
      assert.deepEqual(
        file.tables.journal_entries.find((row) => row.id === entry!.id),
        {
          id: entry!.id,
          entry_date: '2026-11-02',
          title: '뮤지컬, "본 날"',
          body: '첫 줄\n둘째 줄',
          created_at: '2026-11-02T14:00:00.000005Z',
          updated_at: '2026-11-02T23:00:00.500000Z',
        },
      );
      assert.deepEqual(
        file.tables.journal_entry_items.find((row) => row.entry_id === entry!.id),
        {
          entry_id: entry!.id,
          item_id: inserted[1].id,
          linked_at: '2026-11-02T14:05:00.000003Z',
        },
      );
      assert.deepEqual(
        file.tables.audit_log.find((row) => row.id === audit!.id),
        {
          id: audit!.id,
          at: '2026-11-25T14:59:59.000009Z',
          actor_type: 'ai-tool',
          actor_id: null,
          client: 'shared-ai',
          tool: 'life_journal__update_item',
          action: 'update',
          entity: 'items',
          entity_id: String(inserted[0].id),
          result: 'ok',
          before: { title: '옛 제목, "a"' },
          after: { title: 'New' },
          request_id: 'req-7',
        },
      );
      // Every column of each table is in the file, so a new column cannot be left out silently.
      for (const [table, row] of [
        ['items', wish],
        ['item_quotes', file.tables.item_quotes[0]],
        ['item_logs', file.tables.item_logs[0]],
        ['journal_entries', file.tables.journal_entries[0]],
        ['journal_entry_items', file.tables.journal_entry_items[0]],
        ['audit_log', file.tables.audit_log[0]],
      ] as const) {
        const { rows: columns } = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 ORDER BY column_name`,
          [table],
        );
        assert.deepEqual(
          Object.keys(row!).sort(),
          columns.map(({ column_name }) => column_name),
          table,
        );
      }
      assert.deepEqual(
        file.tables.learned_terms.filter(({ term_id }) =>
          ['wine-tannin', 'opera-aria'].includes(String(term_id)),
        ),
        [
          { term_id: 'opera-aria', learned_at: '2026-11-21T00:00:00.000000Z' },
          { term_id: 'wine-tannin', learned_at: '2026-11-20T00:00:00.000004Z' },
        ],
      );

      // The CSV of the same rows reads back to the same values.
      const [header, ...rows] = parseCsv(toCsv(EXPORT_TABLES.items.columns, file.tables.items));
      const doneRow = rows.find((row) => row[0] === String(inserted[1].id))!;
      const value = (column: string) => doneRow[header.indexOf(column)];
      assert.equal(value('title'), 'Done\n on two lines');
      assert.equal(value('review'), 'Line one, "quoted"\nLine two');
      assert.equal(value('link'), 'https://example.com/a?b=c,d');
      assert.deepEqual(JSON.parse(value('details')!), { venue: 'Seoul, Arts Center' });
      assert.deepEqual(JSON.parse(value('sub_ratings')!), { story: 4, music: 5 });
      assert.equal(value('rating'), '4.5');
      assert.deepEqual(JSON.parse(value('tags')!), ['birthday', 'with "quotes", comma']);
      assert.deepEqual(JSON.parse(value('companions')!), ['민지']);
      assert.equal(value('planned_date'), null);
    } finally {
      // Released here, not in t.after: pool.end() waits for every client, so the run would never end.
      await client.query('ROLLBACK').finally(() => client.release());
    }
  },
);
