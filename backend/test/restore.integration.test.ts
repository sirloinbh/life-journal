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
    const tables = ['items', 'item_quotes', 'item_logs', 'audit_log'] as const;
    const sequence = (table: string) => `pg_get_serial_sequence('${table}', 'id')`;
    const started = new Map<string, number>();
    try {
      for (const table of tables) {
        const { rows } = await client.query<{ value: number }>(
          `SELECT COALESCE(pg_sequence_last_value(${sequence(table)}::regclass), 0) AS value`,
        );
        started.set(table, rows[0].value);
      }
      await client.query('BEGIN');
      // Other test files write these tables at the same time; the lock makes them wait until the
      // rollback, so every statement here sees the same rows. Reads still go through.
      await client.query(
        'LOCK TABLE items, item_quotes, item_logs, learned_terms, audit_log IN EXCLUSIVE MODE',
      );
      const { rows: seeded } = await client.query<{ id: number }>(
        `INSERT INTO items (category, subtype, title, status, cost_krw, planned_date, completed_date,
           details, rating, sub_ratings, review, link, tags, companions, created_at, updated_at)
         VALUES
           ('reading', NULL, ' Spaces kept ', 'wishlist', NULL, '2026-12-24', NULL,
            '{"author": "한강"}', NULL, '{}', NULL, NULL, '{}', '{}', '2026-11-20 10:11:12.123456+09', now()),
           ('stage', 'musical', 'Done, "quoted"', 'done', 150000, NULL, '2026-11-02',
            '{"venue": "Seoul"}', 4.5, '{"story": 4}', E'Line one\\nLine two',
            'https://example.com/', ARRAY['birthday', 'a, "b"'], ARRAY['민지'], '2026-11-02 21:00:00+09', '2026-11-03 08:30:00.5+09'),
           ('drink', 'wine', '샤또 마고', 'done', NULL, NULL, '2026-11-01', '{}', 4, '{}', NULL, NULL,
            '{}', '{}', '2026-11-01 20:00:00+09', '2026-11-01 20:00:00+09')
         RETURNING id`,
      );
      await client.query(
        `INSERT INTO item_quotes (item_id, text, page, note, created_at, updated_at)
         VALUES ($1, E'First line, "quoted"
second line', 12, '메모', '2026-11-21 10:00:00.000007+09', now())`,
        [seeded[0].id],
      );
      await client.query(
        `INSERT INTO item_logs (item_id, logged_on, rating, note, cost_krw, created_at, updated_at)
         VALUES ($1, '2026-11-10', 3.5, '두 번째 잔', 30000, '2026-11-10 22:00:00+09', now())`,
        [seeded[2].id],
      );
      await client.query(
        `INSERT INTO learned_terms (term_id, learned_at) VALUES ('wine-tannin', '2026-11-20 09:00:00.000004+09')
         ON CONFLICT (term_id) DO UPDATE SET learned_at = EXCLUDED.learned_at`,
      );
      await client.query(
        `INSERT INTO audit_log (at, actor_type, client, tool, action, entity, entity_id, before, after)
         VALUES ('2026-11-25 23:59:59.000009+09', 'ai-tool', 'shared-ai', 'life_journal__update_item',
           'update', 'items', $1, '{"title": "옛 제목"}', NULL)`,
        [String(seeded[0].id)],
      );

      // Through JSON, as the file travels: export, then parse the text the way the route does.
      const now = new Date('2026-11-26T00:00:00Z');
      const before = await readExport(client, now);
      const file = exportFile.parse(JSON.parse(JSON.stringify(before)));
      assert.ok(before.tables.items.length >= 3);
      assert.ok(before.tables.item_quotes.length >= 1);
      assert.ok(before.tables.item_logs.length >= 1);
      assert.ok(before.tables.audit_log.length >= 1);

      // An empty database, as after `docker compose down -v` and the migrations.
      await client.query('DELETE FROM learned_terms');
      await client.query('DELETE FROM items');
      await client.query('DELETE FROM audit_log');
      const restored = await replaceRecords(client, file);
      assert.deepEqual(restored, {
        items: before.tables.items.length,
        item_quotes: before.tables.item_quotes.length,
        item_logs: before.tables.item_logs.length,
        learned_terms: before.tables.learned_terms.length,
        audit_log: before.tables.audit_log.length,
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

      // Each sequence continues after the largest restored id.
      const largest = (rows: readonly { id: number }[]) => Math.max(...rows.map(({ id }) => id));
      const { rows: item } = await client.query<{ id: number }>(
        "INSERT INTO items (category, title) VALUES ('reading', 'After the restore') RETURNING id",
      );
      assert.equal(item[0].id, largest(file.tables.items) + 1);
      const { rows: quote } = await client.query<{ id: number }>(
        "INSERT INTO item_quotes (item_id, text) VALUES ($1, 'After the restore') RETURNING id",
        [item[0].id],
      );
      assert.equal(quote[0].id, largest(file.tables.item_quotes) + 1);
      const { rows: log } = await client.query<{ id: number }>(
        "INSERT INTO item_logs (item_id, logged_on) VALUES ($1, '2026-11-26') RETURNING id",
        [item[0].id],
      );
      assert.equal(log[0].id, largest(file.tables.item_logs) + 1);
      const { rows: entry } = await client.query<{ id: number }>(
        "INSERT INTO audit_log (actor_type, action, entity) VALUES ('user', 'create', 'items') RETURNING id",
      );
      assert.equal(entry[0].id, largest(file.tables.audit_log) + 1);
    } finally {
      // Released here, not in t.after: pool.end() waits for every client, so the run would never end.
      try {
        await client.query('ROLLBACK');
        // The restore moved the sequences; put them back, never below where they were or below a row.
        for (const table of tables) {
          await client.query(
            `SELECT setval(${sequence(table)}, GREATEST((SELECT max(id) FROM ${table}), $1::bigint, 1))`,
            [started.get(table) ?? 0],
          );
        }
      } finally {
        client.release();
      }
    }
  },
);
