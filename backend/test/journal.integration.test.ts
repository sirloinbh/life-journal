import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { testPool, withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;
const SCHEMA = 'test_journal';
const TODAY = '2026-11-26';

const migration = (file: string) =>
  readFile(new URL(`../../database/migrations/${file}`, import.meta.url), 'utf8');

// #210: the journal table in its own schema, so this file does not depend on the state of the shared one.
// The migration is applied twice to show it is safe to run again.
async function scratchPool(t: { after: (fn: () => Promise<void>) => void }) {
  const setup = testPool({ max: 1 });
  await setup.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA}`);
  await setup.query(`SET search_path TO ${SCHEMA}`);
  const sql = await migration('012_journal_entries.sql');
  await setup.query(sql);
  await setup.query(sql);
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

type Entry = { date: string; body: string; createdAt: string; updatedAt: string };

test(
  'saving twice on one date updates its one entry, and entries list newest first',
  { skip: !url },
  async (t) => {
    const pool = await scratchPool(t);
    await withApi(
      pool,
      async (call) => {
        const put = (date: string, body: string) =>
          call(`/api/journal/${date}`, { method: 'PUT', body: { body } });

        const first = await put(TODAY, 'Saw a play tonight.');
        assert.equal(first.status, 201);
        const created = first.data as Entry;
        assert.equal(created.date, TODAY);
        assert.equal(created.body, 'Saw a play tonight.');

        const second = await put(TODAY, 'Saw a play tonight.\r\nThe second act was better.');
        assert.equal(second.status, 200);
        const updated = second.data as Entry;
        assert.equal(updated.body, 'Saw a play tonight.\nThe second act was better.');
        assert.equal(updated.createdAt, created.createdAt);
        assert.ok(updated.updatedAt >= created.updatedAt);
        const { rows } = await pool.query('SELECT count(*)::int AS count FROM journal_entries');
        assert.deepEqual(rows, [{ count: 1 }]);

        const read = await call(`/api/journal/${TODAY}`);
        assert.equal(read.status, 200);
        assert.deepEqual(read.data, updated);

        // An empty day is a 404, not an empty entry.
        const missing = await call('/api/journal/2026-11-20');
        assert.equal(missing.status, 404);
        assert.equal(missing.data.error, 'Journal entry not found');

        for (const date of ['2026-11-24', '2025-12-31', '2026-01-01']) {
          assert.equal((await put(date, `Entry of ${date}`)).status, 201);
        }
        const firstPage = await call('/api/journal?limit=2');
        assert.equal(firstPage.status, 200);
        assert.deepEqual(
          (firstPage.data.entries as Entry[]).map(({ date }) => date),
          ['2026-11-26', '2026-11-24'],
        );
        assert.equal(firstPage.data.nextOffset, 2);
        assert.equal(firstPage.data.total, 4);
        const lastPage = await call('/api/journal?limit=2&offset=2');
        assert.deepEqual(
          (lastPage.data.entries as Entry[]).map(({ date }) => date),
          ['2026-01-01', '2025-12-31'],
        );
        assert.equal(lastPage.data.nextOffset, null);

        assert.equal((await call(`/api/journal/${TODAY}`, { method: 'DELETE' })).status, 204);
        const again = await call(`/api/journal/${TODAY}`, { method: 'DELETE' });
        assert.equal(again.status, 404);
        assert.equal((await call(`/api/journal/${TODAY}`)).status, 404);
        assert.equal((await call('/api/journal')).data.total, 3);
      },
      { today: () => TODAY },
    );
  },
);

test(
  'the database refuses an empty entry and a second entry for a date',
  { skip: !url },
  async (t) => {
    const pool = await scratchPool(t);
    await assert.rejects(
      pool.query("INSERT INTO journal_entries (entry_date, body) VALUES ('2026-11-01', '')"),
      /journal_entries_body_check/,
    );
    await pool.query("INSERT INTO journal_entries (entry_date, body) VALUES ('2026-11-01', 'a')");
    await assert.rejects(
      pool.query("INSERT INTO journal_entries (entry_date, body) VALUES ('2026-11-01', 'b')"),
      /journal_entries_entry_date_key/,
    );
  },
);
