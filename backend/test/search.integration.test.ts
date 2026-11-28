import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { testPool, withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;
const SCHEMA = 'test_search';

const migration = (file: string) =>
  readFile(new URL(`../../database/migrations/${file}`, import.meta.url), 'utf8');

// #277: a word from a saved record finds the record, in its own schema so this file does not depend on the shared one.
test(
  'a word from a saved item, essay, day log entry and document finds it; % matches literally',
  { skip: !url },
  async (t) => {
    const setup = testPool({ max: 1 });
    await setup.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA}`);
    await setup.query(`SET search_path TO ${SCHEMA}`);
    for (const file of [
      '001_initial.sql',
      '002_items.sql',
      '004_item_review.sql',
      '010_item_tags_companions.sql',
      '015_essays.sql',
      '016_journal_entries.sql',
      '018_notion_pages.sql',
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
    await pool.query(
      `INSERT INTO items (category, title, tags) VALUES ('reading', 'Dune', ARRAY['scifi'])`,
    );
    await pool.query(
      `INSERT INTO essays (title, body, written_date) VALUES ('Morning', 'A walk with zebra stripes', '2026-11-01')`,
    );
    await pool.query(
      `INSERT INTO journal_entries (entry_date, body) VALUES ('2026-11-02', 'Saw a zebra today')`,
    );
    await pool.query(
      `INSERT INTO notion_pages (notion_id, title, body, path, notion_edited_at) VALUES ('n1', 'Zoo plan', 'zebra', 'Zoo plan', now()),
       ('n2', 'Deleted zebra', 'zebra', 'x', now())`,
    );
    await pool.query(`UPDATE notion_pages SET deleted_at = now() WHERE notion_id = 'n2'`);
    await withApi(pool, async (call) => {
      const zebra = (await call('/api/search?q=ZEBRA')).data.results as {
        title: string;
        href: string;
      }[];
      assert.deepEqual(zebra.map((r) => r.href).sort(), [
        '/documents/1',
        '/essays/1',
        '/journal/2026-11-02',
      ]);
      const dune = (await call('/api/search?q=scifi%20dune')).data.results as { href: string }[];
      assert.deepEqual(
        dune.map((r) => r.href),
        ['/table?q=Dune'],
      );
      assert.deepEqual((await call('/api/search?q=%25')).data.results, []);
    });
  },
);
