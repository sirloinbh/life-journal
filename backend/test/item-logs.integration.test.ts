import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { testPool, withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;
const TODAY = '2026-10-31';
const SCHEMA = 'test_item_logs';

const migration = (file: string) =>
  readFile(new URL(`../../database/migrations/${file}`, import.meta.url), 'utf8');

// The items and logs tables in their own schema (as in item-quotes.integration.test.ts), so other test files that
// empty the shared items table while these run cannot delete these items. Every connection searches it first.
async function scratchPool(t: { after: (fn: () => Promise<void>) => void }) {
  const setup = testPool({ max: 1 });
  await setup.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA}`);
  await setup.query(`SET search_path TO ${SCHEMA}`);
  for (const file of [
    '002_items.sql',
    '003_item_ratings.sql',
    '004_item_review.sql',
    '005_item_link.sql',
    '007_coffee_category.sql',
    '009_items_check_names.sql',
    '010_item_tags_companions.sql',
    '011_item_quotes.sql',
    '013_item_logs.sql',
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

const wine = { category: 'drink', subtype: 'wine', title: '샤또 마고' };

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test('the logs migration can be applied again', { skip: !url }, async (t) => {
  const pool = await scratchPool(t);
  await pool.query(await migration('013_item_logs.sql'));
  const { rowCount } = await pool.query(
    `SELECT 1 FROM pg_tables WHERE schemaname = '${SCHEMA}' AND tablename = 'item_logs'`,
  );
  assert.equal(rowCount, 1);
});

test(
  'tastings of a wine are added, listed newest first, edited, and deleted',
  { skip: !url },
  async (t) => {
    const pool = await scratchPool(t);
    await withApi(
      pool,
      async (call) => {
        const item = await call('/api/items', { method: 'POST', body: wine });
        const base = `/api/items/${String(item.data.id)}/logs`;
        const add = (body: unknown) => call(base, { method: 'POST', body });

        const first = await add({
          date: '2026-03-01',
          rating: 3.5,
          note: '아직 닫혀 있음',
          costKrw: 90000,
        });
        assert.equal(first.status, 201);
        assert.deepEqual(
          { ...first.data, id: 0, createdAt: 0, updatedAt: 0 },
          {
            id: 0,
            itemId: item.data.id,
            date: '2026-03-01',
            rating: 3.5,
            note: '아직 닫혀 있음',
            costKrw: 90000,
            createdAt: 0,
            updatedAt: 0,
          },
        );
        assert.equal((await add({ date: TODAY, rating: 4.5 })).status, 201);
        assert.equal((await add({ date: '2026-06-15' })).status, 201);

        const dates = async () =>
          ((await call(base)).data.logs as { date: string }[]).map((log) => log.date);
        assert.deepEqual(await dates(), [TODAY, '2026-06-15', '2026-03-01']);

        const path = `${base}/${String(first.data.id)}`;
        const edited = await call(path, {
          method: 'PATCH',
          body: { date: '2026-07-01', note: null, rating: 4 },
        });
        assert.equal(edited.status, 200);
        assert.deepEqual(
          [edited.data.date, edited.data.rating, edited.data.note, edited.data.costKrw],
          ['2026-07-01', 4, null, 90000],
        );
        assert.deepEqual(await dates(), [TODAY, '2026-07-01', '2026-06-15']);

        // The item's own completion stays as it was: logs never change it.
        const stored = await call(`/api/items/${String(item.data.id)}`);
        assert.deepEqual([stored.data.status, stored.data.rating], ['wishlist', null]);

        // A log is reached only through its own item.
        const other = await call('/api/items', {
          method: 'POST',
          body: { ...wine, title: '다른 와인' },
        });
        const wrongItem = `/api/items/${String(other.data.id)}/logs/${String(first.data.id)}`;
        assert.deepEqual((await call(wrongItem, { method: 'PATCH', body: { rating: 1 } })).data, {
          error: 'Log not found',
        });
        assert.equal((await call(wrongItem, { method: 'DELETE' })).status, 404);

        assert.equal((await call(path, { method: 'DELETE' })).status, 204);
        assert.equal((await call(path, { method: 'DELETE' })).status, 404);
        assert.deepEqual(await dates(), [TODAY, '2026-06-15']);
      },
      { today: () => TODAY },
    );
  },
);

test(
  'only drink and travel items take logs, and a logged item keeps its category',
  { skip: !url },
  async (t) => {
    const pool = await scratchPool(t);
    await withApi(
      pool,
      async (call) => {
        const book = await call('/api/items', {
          method: 'POST',
          body: { category: 'reading', title: '데미안' },
        });
        const refused = await call(`/api/items/${String(book.data.id)}/logs`, {
          method: 'POST',
          body: { date: TODAY },
        });
        assert.deepEqual(
          [refused.status, refused.data],
          [400, { error: 'Only drink and travel items can have tastings and visits' }],
        );
        const missing = await call('/api/items/999999999/logs', {
          method: 'POST',
          body: { date: TODAY },
        });
        assert.deepEqual([missing.status, missing.data], [404, { error: 'Item not found' }]);
        assert.equal((await call('/api/items/999999999/logs')).status, 404);

        const trip = await call('/api/items', {
          method: 'POST',
          body: { category: 'travel', title: '교토' },
        });
        const path = `/api/items/${String(trip.data.id)}`;
        const visit = await call(`${path}/logs`, { method: 'POST', body: { date: TODAY } });
        assert.equal(visit.status, 201);
        const move = () =>
          call(path, { method: 'PATCH', body: { category: 'coffee', title: '교토 커피' } });
        assert.deepEqual((await move()).data, {
          error: 'Delete the tastings and visits of this item before moving it to another category',
        });
        assert.equal((await call(path)).data.category, 'travel');
        // Other edits of a logged item still work, including completing it.
        const done = await call(path, {
          method: 'PATCH',
          body: { status: 'done', completedDate: TODAY, rating: 5 },
        });
        assert.equal(done.status, 200);
        await call(`${path}/logs/${String(visit.data.id)}`, { method: 'DELETE' });
        assert.equal((await move()).status, 200);
      },
      { today: () => TODAY },
    );
  },
);

test('logs go with their item, and the table refuses bad rows', { skip: !url }, async (t) => {
  const pool = await scratchPool(t);
  await withApi(
    pool,
    async (call) => {
      const item = await call('/api/items', { method: 'POST', body: wine });
      const id = item.data.id as number;
      await call(`/api/items/${String(id)}/logs`, { method: 'POST', body: { date: TODAY } });
      await call(`/api/items/${String(id)}/logs`, { method: 'POST', body: { date: TODAY } });
      assert.equal((await call(`/api/items/${String(id)}`, { method: 'DELETE' })).status, 204);
      const { rowCount } = await pool.query('SELECT 1 FROM item_logs WHERE item_id = $1', [id]);
      assert.equal(rowCount, 0);
    },
    { today: () => TODAY },
  );
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO items (category, subtype, title) VALUES ('drink', 'wine', 'x') RETURNING id",
  );
  const itemId = rows[0]!.id;
  for (const [columns, values] of [
    ['logged_on, rating', "'2026-01-01', 0"],
    ['logged_on, rating', "'2026-01-01', 5.5"],
    ['logged_on, rating', "'2026-01-01', 4.3"],
    ['logged_on, note', "'2026-01-01', ' '"],
    ['logged_on, note', "'2026-01-01', repeat('a', 501)"],
    ['logged_on, cost_krw', "'2026-01-01', -1"],
  ]) {
    const sql = `INSERT INTO item_logs (item_id, ${columns}) VALUES (${String(itemId)}, ${values})`;
    await assert.rejects(pool.query(sql), { code: '23514' }, sql);
  }
  await assert.rejects(pool.query(`INSERT INTO item_logs (item_id) VALUES (${String(itemId)})`), {
    code: '23502',
  });
  await assert.rejects(
    pool.query("INSERT INTO item_logs (item_id, logged_on) VALUES (999999999, '2026-01-01')"),
    { code: '23503' },
  );
});
