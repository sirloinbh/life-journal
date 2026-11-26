import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readExport } from '../src/export.js';
import { exportFile, replaceRecords } from '../src/restore.js';
import { testPool } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

// Everything runs in one transaction that is rolled back, so other test files that use the same tables
// at the same time see none of it. setval is not transactional, so the sequence is put back at the end.
test(
  'an export restored into an empty database gives the same rows, a refused file changes nothing, and new ids continue',
  { skip: !url },
  async (t) => {
    const pool = testPool();
    t.after(() => pool.end());
    const client = await pool.connect();
    const sequence = "pg_get_serial_sequence('items', 'id')";
    let started = 0;
    try {
      const { rows: sequenceRows } = await client.query<{ value: number }>(
        `SELECT COALESCE(pg_sequence_last_value(${sequence}::regclass), 0) AS value`,
      );
      started = sequenceRows[0].value;
      await client.query('BEGIN');
      // Other test files write these tables at the same time; the lock makes them wait until the
      // rollback, so every statement here sees the same rows. Reads still go through.
      await client.query('LOCK TABLE items, learned_terms IN EXCLUSIVE MODE');
      await client.query(
        `INSERT INTO items (category, subtype, title, status, cost_krw, planned_date, completed_date,
           details, rating, sub_ratings, review, link, tags, companions, created_at, updated_at)
         VALUES
           ('reading', NULL, ' Spaces kept ', 'wishlist', NULL, '2026-12-24', NULL,
            '{"author": "한강"}', NULL, '{}', NULL, NULL, '{}', '{}', '2026-11-20 10:11:12.123456+09', now()),
           ('stage', 'musical', 'Done, "quoted"', 'done', 150000, NULL, '2026-11-02',
            '{"venue": "Seoul"}', 4.5, '{"story": 4}', E'Line one\\nLine two',
            'https://example.com/', ARRAY['birthday', 'a, "b"'], ARRAY['민지'], '2026-11-02 21:00:00+09', '2026-11-03 08:30:00.5+09')`,
      );
      await client.query(
        `INSERT INTO learned_terms (term_id, learned_at) VALUES ('wine-tannin', '2026-11-20 09:00:00.000004+09')
         ON CONFLICT (term_id) DO UPDATE SET learned_at = EXCLUDED.learned_at`,
      );

      // Through JSON, as the file travels: export, then parse the text the way the route does.
      const now = new Date('2026-11-26T00:00:00Z');
      const before = await readExport(client, now);
      const file = exportFile.parse(JSON.parse(JSON.stringify(before)));
      assert.ok(before.tables.items.length >= 2);

      // An empty database, as after `docker compose down -v` and the migrations.
      await client.query('DELETE FROM learned_terms');
      await client.query('DELETE FROM items');
      const restored = await replaceRecords(client, file);
      assert.deepEqual(restored, {
        items: before.tables.items.length,
        learned_terms: before.tables.learned_terms.length,
      });
      assert.deepEqual(await readExport(client, now), before);

      // One invalid row (a rating the CHECK refuses) rolls the whole restore back.
      await client.query('SAVEPOINT broken');
      const broken = structuredClone(file);
      broken.tables.items[0].title = 'Changed before the bad row';
      broken.tables.items.push({
        ...broken.tables.items[0],
        id: Math.max(...broken.tables.items.map(({ id }) => id)) + 1,
        status: 'done',
        completed_date: '2026-11-01',
        rating: 4.3,
      });
      await assert.rejects(replaceRecords(client, broken), { code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT broken');
      assert.deepEqual(await readExport(client, now), before);

      // The sequence continues after the largest restored id.
      const largest = Math.max(...file.tables.items.map(({ id }) => id));
      const { rows } = await client.query<{ id: number }>(
        "INSERT INTO items (category, title) VALUES ('reading', 'After the restore') RETURNING id",
      );
      assert.equal(rows[0].id, largest + 1);
    } finally {
      // Released here, not in t.after: pool.end() waits for every client, so the run would never end.
      try {
        await client.query('ROLLBACK');
        // The restore moved the sequence; put it back, never below where it was or below a row.
        await client.query(
          `SELECT setval(${sequence}, GREATEST((SELECT max(id) FROM items), $1::bigint, 1))`,
          [started],
        );
      } finally {
        client.release();
      }
    }
  },
);
