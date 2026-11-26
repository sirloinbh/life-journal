import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { testPool, withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;
const SCHEMA = 'test_journal_items';
const TODAY = '2026-11-26';

const migration = (file: string) =>
  readFile(new URL(`../../database/migrations/${file}`, import.meta.url), 'utf8');

// #211: the items, journal, and link tables in their own schema, so this file does not depend on the state of the
// shared one. The link migration is applied twice to show it is safe to run again.
async function scratchPool(t: { after: (fn: () => Promise<void>) => void }) {
  const setup = testPool({ max: 1 });
  await setup.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA}`);
  await setup.query(`SET search_path TO ${SCHEMA}`);
  for (const file of [
    '002_items.sql',
    '003_item_ratings.sql',
    '016_journal_entries.sql',
    '017_journal_entry_items.sql',
    '017_journal_entry_items.sql',
  ]) {
    await setup.query(await migration(file));
  }
  await setup.end();
  const pool = testPool({ options: `-c search_path=${SCHEMA}` });
  t.after(async () => {
    try {
      await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    } finally {
      await pool.end();
    }
  });
  return pool;
}

async function addItem(pool: Pool, title: string, completedDate: string | null) {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO items (category, title, status, completed_date) VALUES ('stage', $1, $2, $3) RETURNING id`,
    [title, completedDate ? 'done' : 'wishlist', completedDate],
  );
  return rows[0].id;
}

async function addEntry(pool: Pool, date: string) {
  await pool.query('INSERT INTO journal_entries (entry_date, body) VALUES ($1, $2)', [
    date,
    'A day',
  ]);
}

const titles = (items: unknown) => (items as { title: string }[]).map(({ title }) => title);

test(
  'items completed on the day are suggested, linked once, listed, and unlinked',
  { skip: !url },
  async (t) => {
    const pool = await scratchPool(t);
    const play = await addItem(pool, 'A play', TODAY);
    await addItem(pool, 'A concert', TODAY);
    const yesterday = await addItem(pool, 'Yesterday', '2026-11-25');
    const wish = await addItem(pool, 'Someday', null);
    await withApi(
      pool,
      async (call) => {
        const items = () => call(`/api/journal/${TODAY}/items`);
        const link = (id: number | string) =>
          call(`/api/journal/${TODAY}/items/${id}`, { method: 'PUT' });

        // Without an entry there is nothing to link to, but the day's items are suggested.
        const before = await items();
        assert.equal(before.status, 200);
        assert.deepEqual(before.data.linked, []);
        assert.deepEqual(titles(before.data.suggestions), ['A play', 'A concert']);
        const noEntry = await link(play);
        assert.equal(noEntry.status, 404);
        assert.equal(noEntry.data.error, 'Journal entry not found');

        await addEntry(pool, TODAY);
        const first = await link(play);
        assert.equal(first.status, 201);
        assert.deepEqual(first.data, {
          id: play,
          category: 'stage',
          subtype: null,
          title: 'A play',
          completedDate: TODAY,
          rating: null,
        });
        assert.equal((await link(play)).status, 200);
        const after = await items();
        assert.deepEqual(titles(after.data.linked), ['A play']);
        assert.deepEqual(titles(after.data.suggestions), ['A concert']);

        // Another day's item, a wishlist item, and a missing item are refused.
        for (const id of [yesterday, wish]) {
          const refused = await link(id);
          assert.equal(refused.status, 400);
          assert.equal(
            refused.data.error,
            'Only items completed on the day of the entry can be linked',
          );
        }
        const missing = await link(999_999);
        assert.equal(missing.status, 404);
        assert.equal(missing.data.error, 'Item not found');
        assert.equal((await link('x')).status, 400);

        const unlink = () => call(`/api/journal/${TODAY}/items/${play}`, { method: 'DELETE' });
        assert.equal((await unlink()).status, 204);
        const again = await unlink();
        assert.equal(again.status, 404);
        assert.equal(again.data.error, 'Link not found');
        assert.deepEqual((await items()).data.linked, []);
      },
      { today: () => TODAY },
    );
  },
);

test(
  'a link goes away with its entry, its item, or a change of the completed date',
  { skip: !url },
  async (t) => {
    const pool = await scratchPool(t);
    const ids = await Promise.all(
      ['Moved', 'Undone', 'Renamed', 'Deleted'].map((title) => addItem(pool, title, TODAY)),
    );
    const [moved, undone, renamed, deleted] = ids;
    await addEntry(pool, TODAY);
    const { rows } = await pool.query<{ id: number }>('SELECT id FROM journal_entries');
    const entryId = rows[0].id;
    for (const id of ids) {
      await pool.query('INSERT INTO journal_entry_items (entry_id, item_id) VALUES ($1, $2)', [
        entryId,
        id,
      ]);
    }
    const linked = async () =>
      (
        await pool.query<{ item_id: number }>(
          'SELECT item_id FROM journal_entry_items ORDER BY item_id',
        )
      ).rows.map((row) => row.item_id);

    await pool.query("UPDATE items SET completed_date = '2026-11-25' WHERE id = $1", [moved]);
    await pool.query("UPDATE items SET status = 'wishlist', completed_date = NULL WHERE id = $1", [
      undone,
    ]);
    await pool.query("UPDATE items SET title = 'Renamed again' WHERE id = $1", [renamed]);
    await pool.query('DELETE FROM items WHERE id = $1', [deleted]);
    assert.deepEqual(await linked(), [renamed]);

    // A second link of the same pair is refused by the key.
    await assert.rejects(
      pool.query('INSERT INTO journal_entry_items (entry_id, item_id) VALUES ($1, $2)', [
        entryId,
        renamed,
      ]),
      /journal_entry_items_pkey/,
    );

    await pool.query('DELETE FROM journal_entries WHERE id = $1', [entryId]);
    assert.deepEqual(await linked(), []);
  },
);
