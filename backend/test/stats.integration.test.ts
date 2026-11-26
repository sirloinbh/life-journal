import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { testPool, withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;
const SCHEMA = 'test_stats';

const migration = (file: string) =>
  readFile(new URL(`../../database/migrations/${file}`, import.meta.url), 'utf8');

// #212: the items table in its own schema, so other test files that empty the shared table cannot
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

type Seed = {
  category: string;
  subtype?: string;
  title: string;
  completed: string | null;
  rating?: number;
  cost?: number;
};

test(
  'the statistics count done items of the year by completed date, with spending, averages, and the top 5',
  { skip: !url },
  async (t) => {
    const pool = await scratchPool(t);
    const ids: Record<string, number> = {};
    const seed = async ({ category, subtype, title, completed, rating, cost }: Seed) => {
      const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO items (category, subtype, title, status, completed_date, planned_date, rating, cost_krw)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          category,
          subtype ?? null,
          title,
          completed ? 'done' : 'wishlist',
          completed,
          completed ? null : '2026-05-01',
          rating ?? null,
          cost ?? null,
        ],
      );
      ids[title] = rows[0]!.id;
    };
    for (const item of [
      {
        category: 'reading',
        title: 'New Year book',
        completed: '2026-01-01',
        rating: 4,
        cost: 10000,
      },
      { category: 'reading', title: 'Year-end book', completed: '2026-12-31', rating: 5 },
      { category: 'reading', title: 'Last year', completed: '2025-12-31', rating: 5, cost: 50000 },
      { category: 'reading', title: 'Next year', completed: '2027-01-01', rating: 5, cost: 70000 },
      {
        category: 'screen',
        subtype: 'movie',
        title: 'Unrated film',
        completed: '2026-03-10',
        cost: 15000,
      },
      {
        category: 'screen',
        subtype: 'movie',
        title: 'Rated film',
        completed: '2026-03-20',
        rating: 3,
        cost: 12000,
      },
      {
        category: 'stage',
        subtype: 'opera',
        title: 'Opera A',
        completed: '2026-06-01',
        rating: 5,
        cost: 120000,
      },
      { category: 'stage', subtype: 'opera', title: 'Opera B', completed: '2026-06-01', rating: 5 },
      { category: 'drink', subtype: 'wine', title: 'Wishlist wine', completed: null, cost: 80000 },
      { category: 'coffee', title: 'Coffee', completed: '2026-07-07', rating: 4.5, cost: 6000 },
      { category: 'travel', title: 'Trip 1', completed: '2026-08-08', rating: 2, cost: 300000 },
      { category: 'travel', title: 'Trip 2', completed: '2026-08-09', rating: 2.5 },
      { category: 'travel', title: 'Trip 3', completed: '2026-08-10', rating: 2.5 },
    ]) {
      await seed(item);
    }

    await withApi(pool, async (call) => {
      const { status, data } = await call('/api/stats?year=2026');
      assert.equal(status, 200);
      assert.equal(data.year, '2026');
      // Jan 1 and Dec 31 count; Dec 31 of last year, Jan 1 of next year, and the wishlist item do not.
      assert.equal(data.completed, 10);
      // Items with no cost add nothing; the wishlist wine's cost is left out.
      assert.equal(data.spendingKrw, 10000 + 15000 + 12000 + 120000 + 6000 + 300000);

      const months = data.months as {
        month: string;
        total: number;
        categories: Record<string, number>;
      }[];
      assert.deepEqual(
        months.map(({ total }) => total),
        [1, 0, 2, 0, 0, 2, 1, 3, 0, 0, 0, 1],
      );
      assert.deepEqual(months[0], {
        month: '2026-01',
        total: 1,
        categories: { reading: 1, screen: 0, stage: 0, drink: 0, travel: 0, coffee: 0 },
      });
      assert.equal(months[11]!.categories.reading, 1);

      // Unrated items are left out of the average; the average is rounded to two decimals.
      assert.deepEqual(data.categories, [
        { category: 'reading', completed: 2, rated: 2, averageRating: 4.5, spendingKrw: 10000 },
        { category: 'screen', completed: 2, rated: 1, averageRating: 3, spendingKrw: 27000 },
        { category: 'stage', completed: 2, rated: 2, averageRating: 5, spendingKrw: 120000 },
        { category: 'drink', completed: 0, rated: 0, averageRating: null, spendingKrw: 0 },
        { category: 'travel', completed: 3, rated: 3, averageRating: 2.33, spendingKrw: 300000 },
        { category: 'coffee', completed: 1, rated: 1, averageRating: 4.5, spendingKrw: 6000 },
      ]);

      // Ties go to the later completion, then the higher id; only five are listed.
      const top = data.topRated as { id: number; title: string }[];
      assert.deepEqual(
        top.map(({ title }) => title),
        ['Year-end book', 'Opera B', 'Opera A', 'Coffee', 'New Year book'],
      );
      assert.deepEqual(top[0], {
        id: ids['Year-end book'],
        category: 'reading',
        subtype: null,
        title: 'Year-end book',
        rating: 5,
        completedDate: '2026-12-31',
      });

      const lastYear = await call('/api/stats?year=2025');
      assert.equal(lastYear.data.completed, 1);
      assert.equal(lastYear.data.spendingKrw, 50000);
      // The year after 9999 is still a date PostgreSQL can compare with.
      const farEnd = await call('/api/stats?year=9999');
      assert.equal(farEnd.status, 200);
      assert.equal(farEnd.data.completed, 0);
    });
  },
);
