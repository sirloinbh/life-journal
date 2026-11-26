import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXPORT_TABLES, readExport, toCsv } from '../src/export.js';
import { parseCsv } from './csv.js';
import { testPool } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

// The rows are written and read inside one transaction that is rolled back, so other test files that
// clear the tables at the same time cannot change what this test sees, and nothing is left behind.
test(
  'an export of a seeded database holds every item and learned term with all fields',
  { skip: !url },
  async (t) => {
    const pool = testPool();
    t.after(() => pool.end());
    const client = await pool.connect();
    await client.query('BEGIN');
    try {
      const { rows: inserted } = await client.query<{ id: number }>(
        `INSERT INTO items (category, subtype, title, status, cost_krw, planned_date, completed_date,
           details, rating, sub_ratings, review, link, created_at, updated_at)
         VALUES
           ('reading', NULL, 'Wish, with "quotes"', 'wishlist', NULL, '2026-12-24', NULL,
            '{"author": "한강"}', NULL, '{}', NULL, NULL,
            '2026-11-20 10:11:12.123456+09', '2026-11-21 00:00:00.000001+09'),
           ('stage', 'musical', 'Done
 on two lines', 'done', 150000, NULL, '2026-11-02',
            '{"venue": "Seoul, Arts Center"}', 4.5, '{"story": 4, "music": 5}',
            'Line one, "quoted"
Line two', 'https://example.com/a?b=c,d',
            '2026-11-02 21:00:00+09', '2026-11-03 08:30:00.5+09')
         RETURNING id`,
      );
      await client.query(
        `INSERT INTO learned_terms (term_id, learned_at) VALUES
           ('wine-tannin', '2026-11-20 09:00:00.000004+09'), ('opera-aria', '2026-11-21 09:00:00+09')
         ON CONFLICT (term_id) DO UPDATE SET learned_at = EXCLUDED.learned_at`,
      );

      const file = await readExport(client, new Date('2026-11-26T00:00:00Z'));
      assert.equal(file.format, 'life-journal-export');
      assert.equal(file.version, 1);
      assert.equal(file.exportedAt, '2026-11-26T09:00:00.000+09:00');

      // Every row, not only the seeded ones.
      for (const table of ['items', 'learned_terms'] as const) {
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
        created_at: '2026-11-02T12:00:00.000000Z',
        updated_at: '2026-11-02T23:30:00.500000Z',
      });
      // Every column of the table is in the file, so a new column cannot be left out silently.
      const { rows: columns } = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 ORDER BY column_name`,
        ['items'],
      );
      assert.deepEqual(
        Object.keys(wish!).sort(),
        columns.map(({ column_name }) => column_name),
      );
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
      assert.equal(value('planned_date'), null);
    } finally {
      // Released here, not in t.after: pool.end() waits for every client, so the run would never end.
      await client.query('ROLLBACK').finally(() => client.release());
    }
  },
);
