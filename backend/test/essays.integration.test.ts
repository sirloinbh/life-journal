import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { testPool, withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;
const SCHEMA = 'test_essays';
const TODAY = '2026-11-26';

const migration = (file: string) =>
  readFile(new URL(`../../database/migrations/${file}`, import.meta.url), 'utf8');

// The essays table in its own schema; 010 brings the tag rule (item_names_valid) and 008 the audit log.
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
    '008_audit_log.sql',
    '009_items_check_names.sql',
    '010_item_tags_companions.sql',
    '015_essays.sql',
  ]) {
    await setup.query(await migration(file));
  }
  // Applied twice to show it is safe to run again.
  await setup.query(await migration('015_essays.sql'));
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

type Essay = {
  id: number;
  title: string;
  body: string;
  writtenDate: string;
  status: string;
  tags: string[];
  wordCount?: number;
};

const titles = (essays: unknown) => (essays as Essay[]).map(({ title }) => title);

test('an essay is created, edited, listed, searched, and deleted', { skip: !url }, async (t) => {
  const pool = await scratchPool(t);
  await withApi(
    pool,
    async (call) => {
      // A draft can start with nothing: the title becomes Untitled and the date today.
      const started = await call('/api/essays', { method: 'POST', body: {} });
      assert.equal(started.status, 201);
      const draft = started.data as unknown as Essay;
      assert.equal(draft.title, 'Untitled');
      assert.equal(draft.writtenDate, TODAY);
      assert.equal(draft.status, 'draft');
      assert.equal(draft.body, '');

      const saved = await call(`/api/essays/${draft.id}`, {
        method: 'PATCH',
        body: {
          title: '  On walking  ',
          body: 'Walking is\r\nthinking with the legs.',
          tags: ['Walking', 'walking', 'habits'],
          status: 'done',
        },
      });
      assert.equal(saved.status, 200);
      const essay = saved.data as unknown as Essay;
      assert.equal(essay.title, 'On walking');
      assert.equal(essay.body, 'Walking is\nthinking with the legs.');
      assert.deepEqual(essay.tags, ['Walking', 'habits']);

      const other = await call('/api/essays', {
        method: 'POST',
        body: { title: 'Rain', body: 'It rained.', writtenDate: '2026-11-01', tags: ['weather'] },
      });
      assert.equal(other.status, 201);

      const list = await call('/api/essays');
      const essays = list.data.essays as Essay[];
      assert.deepEqual(titles(essays), ['On walking', 'Rain']);
      assert.equal(essays[0]?.wordCount, 6);
      assert.equal('body' in (essays[0] as object), false);
      assert.equal(list.data.total, 2);

      assert.deepEqual(titles((await call('/api/essays?q=LEGS')).data.essays), ['On walking']);
      assert.deepEqual(titles((await call('/api/essays?tag=WEATHER')).data.essays), ['Rain']);
      assert.deepEqual(titles((await call('/api/essays?status=draft')).data.essays), ['Rain']);
      // Each used once, so only the set is fixed; the order among equals follows the database collation.
      assert.deepEqual([...((await call('/api/essays/tags')).data.tags as string[])].sort(), [
        'Walking',
        'habits',
        'weather',
      ]);

      const read = await call(`/api/essays/${draft.id}`);
      assert.equal((read.data as unknown as Essay).body, 'Walking is\nthinking with the legs.');

      assert.equal((await call(`/api/essays/${draft.id}`, { method: 'DELETE' })).status, 204);
      assert.equal((await call(`/api/essays/${draft.id}`)).status, 404);
      assert.equal((await call(`/api/essays/${draft.id}`, { method: 'DELETE' })).status, 404);

      // One audit row for each change, without the text.
      const { rows } = await pool.query<{ action: string; after: unknown }>(
        `SELECT action, after FROM audit_log WHERE entity = 'essay' ORDER BY id`,
      );
      assert.deepEqual(
        rows.map(({ action }) => action),
        ['create', 'update', 'create', 'delete'],
      );
      assert.ok(rows.every((row) => !JSON.stringify(row.after).includes('thinking')));
    },
    { today: () => TODAY },
  );
});
