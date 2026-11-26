import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { testPool, withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;
const SCHEMA = 'test_calendar';

const migration = (file: string) =>
  readFile(new URL(`../../database/migrations/${file}`, import.meta.url), 'utf8');

// #213: the items table in its own schema, so other test files that empty the shared table cannot
// change what this one sees. Every connection of the pool searches that schema first.
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

test(
  'the calendar returns exactly the items planned or completed inside the month',
  { skip: !url },
  async (t) => {
    const pool = await scratchPool(t);
    const insert = async (title: string, planned: string | null, completed: string | null) => {
      const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO items (category, title, status, planned_date, completed_date)
         VALUES ('reading', $1, $2, $3, $4) RETURNING id`,
        [title, completed ? 'done' : 'wishlist', planned, completed],
      );
      return rows[0]!.id;
    };
    await insert('planned on the last day of October', '2026-10-31', null);
    const first = await insert('planned on the first day', '2026-11-01', null);
    const last = await insert('completed on the last day', null, '2026-11-30');
    await insert('planned on the first day of December', '2026-12-01', null);
    const across = await insert(
      'planned in October, completed in November',
      '2026-10-20',
      '2026-11-15',
    );
    const both = await insert('planned and completed in November', '2026-11-03', '2026-11-04');
    await insert('no dates', null, null);
    await insert('completed in December last year', null, '2025-12-15');

    await withApi(
      pool,
      async (call) => {
        const { status, data } = await call('/api/calendar?month=2026-11');
        assert.equal(status, 200);
        assert.equal(data.month, '2026-11');
        const items = data.items as {
          id: number;
          plannedDate: string | null;
          completedDate: string | null;
        }[];
        // Ordered by the earliest date of each item that falls inside the month.
        assert.deepEqual(
          items.map(({ id }) => id),
          [first, both, across, last],
        );
        assert.deepEqual(items[2], {
          id: across,
          category: 'reading',
          subtype: null,
          title: 'planned in October, completed in November',
          status: 'done',
          plannedDate: '2026-10-20',
          completedDate: '2026-11-15',
          rating: null,
        });

        // December starts on the first and the year rolls over after it.
        const december = await call('/api/calendar?month=2026-12');
        assert.deepEqual(
          (december.data.items as { title: string }[]).map(({ title }) => title),
          ['planned on the first day of December'],
        );
        const lastYear = await call('/api/calendar?month=2025-12');
        assert.deepEqual(
          (lastYear.data.items as { title: string }[]).map(({ title }) => title),
          ['completed in December last year'],
        );
        // The last month PostgreSQL's dates reach in four digits still has a next month to stop at.
        const farEnd = await call('/api/calendar?month=9999-12');
        assert.equal(farEnd.status, 200);
        assert.deepEqual(farEnd.data.items, []);
      },
      { today: () => '2026-11-30' },
    );
  },
);
