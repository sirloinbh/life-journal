import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

// #213: a month that is not a real YYYY-MM is refused before any query reaches the database.
function untouchedPool() {
  const fail = () => {
    throw new Error('The database must not be used for invalid input');
  };
  return { query: fail, connect: fail } as unknown as Pool;
}

const refused: { name: string; query: string; error: string }[] = [
  {
    name: 'a full date',
    query: 'month=2026-11-01',
    error: 'Month must be a real month in YYYY-MM format',
  },
  {
    name: 'month 13',
    query: 'month=2026-13',
    error: 'Month must be a real month in YYYY-MM format',
  },
  {
    name: 'month 00',
    query: 'month=2026-00',
    error: 'Month must be a real month in YYYY-MM format',
  },
  {
    name: 'year zero',
    query: 'month=0000-01',
    error: 'Month must be a real month in YYYY-MM format',
  },
  {
    name: 'a two-digit year',
    query: 'month=26-11',
    error: 'Month must be a real month in YYYY-MM format',
  },
  {
    name: 'two months',
    query: 'month=2026-11&month=2026-12',
    error: 'Month must be a real month in YYYY-MM format',
  },
  {
    name: 'an unknown filter',
    query: 'month=2026-11&category=reading',
    error: 'The calendar request contains an unknown filter',
  },
];

for (const { name, query, error } of refused) {
  test(`the calendar refuses ${name}`, async () => {
    await withApi(untouchedPool(), async (call) => {
      const { status, data } = await call(`/api/calendar?${query}`);
      assert.equal(status, 400);
      assert.equal(data.error, error);
    });
  });
}

// Without a month the calendar shows this month in the service time zone, from its first day on.
test('the calendar defaults to the month of today', async () => {
  const queries: unknown[][] = [];
  const pool = {
    query: async (_text: string, params: unknown[]) => {
      queries.push(params);
      return { rows: [] };
    },
  } as unknown as Pool;
  await withApi(
    pool,
    async (call) => {
      const { status, data } = await call('/api/calendar');
      assert.equal(status, 200);
      assert.deepEqual(data, { month: '2027-01', items: [] });
    },
    { today: () => '2027-01-01' },
  );
  assert.deepEqual(queries, [['2027-01-01']]);
});
