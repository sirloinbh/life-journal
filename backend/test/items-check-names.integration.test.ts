import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { Pool, type PoolClient } from 'pg';

const url = process.env.TEST_DATABASE_URL;

// #145: the names later migrations can rely on.
const NAMES = [
  'items_category_check',
  'items_cost_krw_check',
  'items_details_check',
  'items_link_check',
  'items_rating_check',
  'items_review_check',
  'items_status_check',
  'items_status_dates',
  'items_sub_ratings_check',
  'items_title_check',
];

const migration = (file: string) =>
  readFile(new URL(`../../database/migrations/${file}`, import.meta.url), 'utf8');

async function checkNames(client: Pool | PoolClient) {
  const { rows } = await client.query<{ conname: string }>(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'items'::regclass AND contype = 'c' ORDER BY conname`,
  );
  return rows.map((row) => row.conname);
}

// The items table of 002-007 (generated CHECK names) in its own schema, so the shared table is not locked.
async function scratchItems(t: { after: (fn: () => Promise<void>) => void }, schema: string) {
  // One client: search_path belongs to the connection.
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  t.after(async () => {
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      client.release();
      await pool.end();
    }
  });
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  for (const file of [
    '002_items.sql',
    '003_item_ratings.sql',
    '004_item_review.sql',
    '005_item_link.sql',
    '007_coffee_category.sql',
  ]) {
    await client.query(await migration(file));
  }
  return client;
}

test('every CHECK on items has its explicit name after db:migrate', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  // 010 (#215) adds the CHECKs of the tag and companion lists by name.
  const names = [...NAMES, 'items_companions_check', 'items_tags_check'].sort();
  assert.deepEqual(await checkNames(pool), names, 'Apply database/migrations with db:migrate');
});

test('009 renames the generated CHECK names and can run again', { skip: !url }, async (t) => {
  const client = await scratchItems(t, 'test_check_names');
  assert.ok((await checkNames(client)).includes('items_check'), 'Starts from generated names');
  await client.query(await migration('009_items_check_names.sql'));
  await client.query(await migration('009_items_check_names.sql'));
  assert.deepEqual(await checkNames(client), NAMES);
  await assert.rejects(
    client.query(
      "INSERT INTO items (category, title, status, completed_date) VALUES ('reading', 'x', 'wishlist', '2026-11-01')",
    ),
    { constraint: 'items_status_dates' },
  );
});

test('009 drops a category CHECK that 007 missed', { skip: !url }, async (t) => {
  const client = await scratchItems(t, 'test_check_names_category');
  await client.query(`ALTER TABLE items ADD CONSTRAINT items_category_old
    CHECK (category IN ('reading', 'screen', 'stage', 'drink', 'travel'))`);
  await assert.rejects(
    client.query("INSERT INTO items (category, title) VALUES ('coffee', 'Kenya')"),
    { constraint: 'items_category_old' },
  );
  await client.query(await migration('009_items_check_names.sql'));
  assert.deepEqual(await checkNames(client), NAMES);
  await client.query("INSERT INTO items (category, title) VALUES ('coffee', 'Kenya')");
});

test('009 fails when an expected CHECK is missing', { skip: !url }, async (t) => {
  const client = await scratchItems(t, 'test_check_names_missing');
  await client.query('ALTER TABLE items DROP CONSTRAINT items_link_check');
  await assert.rejects(client.query(await migration('009_items_check_names.sql')), {
    message: 'items has no CHECK on (link) to name items_link_check',
  });
});
