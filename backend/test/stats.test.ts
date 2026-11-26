import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

// #212: a year that is not 4 digits is refused before any query reaches the database.
function untouchedPool() {
  const fail = () => {
    throw new Error('The database must not be used for invalid input');
  };
  return { query: fail, connect: fail } as unknown as Pool;
}

const yearMessage = 'Year must be a 4-digit year from 0001 to 9999';
const refused: { name: string; query: string; error: string }[] = [
  { name: 'a two-digit year', query: 'year=26', error: yearMessage },
  { name: 'a five-digit year', query: 'year=20260', error: yearMessage },
  { name: 'year zero', query: 'year=0000', error: yearMessage },
  { name: 'a month', query: 'year=2026-11', error: yearMessage },
  { name: 'two years', query: 'year=2025&year=2026', error: yearMessage },
  {
    name: 'an unknown filter',
    query: 'year=2026&category=reading',
    error: 'The statistics request contains an unknown filter',
  },
];

for (const { name, query, error } of refused) {
  test(`the statistics refuse ${name}`, async () => {
    await withApi(untouchedPool(), async (call) => {
      const { status, data } = await call(`/api/stats?${query}`);
      assert.equal(status, 400);
      assert.equal(data.error, error);
    });
  });
}

// Without a year the statistics cover this year in the service time zone; with no rows every month and
// category still appears, with zeros.
test('the statistics default to the year of today and fill empty months', async () => {
  const asked: unknown[] = [];
  const pool = {
    query: (_text: string, params: unknown[]) => {
      asked.push(params);
      return Promise.resolve({ rows: [] });
    },
  } as unknown as Pool;
  await withApi(
    pool,
    async (call) => {
      const { status, data } = await call('/api/stats');
      assert.equal(status, 200);
      assert.equal(data.year, '2027');
      assert.equal(data.completed, 0);
      assert.equal(data.spendingKrw, 0);
      const months = data.months as { month: string; total: number }[];
      assert.deepEqual(
        months.map(({ month, total }) => [month, total]),
        Array.from({ length: 12 }, (_, i) => [`2027-${String(i + 1).padStart(2, '0')}`, 0]),
      );
      const categories = data.categories as { category: string; averageRating: unknown }[];
      assert.deepEqual(
        categories.map(({ category, averageRating }) => [category, averageRating]),
        ['reading', 'screen', 'stage', 'drink', 'travel', 'coffee'].map((key) => [key, null]),
      );
      assert.deepEqual(data.topRated, []);
    },
    { today: () => '2027-01-01' },
  );
  assert.deepEqual(asked, [['2027-01-01'], ['2027-01-01'], ['2027-01-01']]);
});
