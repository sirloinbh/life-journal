import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

// #237: GET /api/items/names answers the tags and the companions already used, each from its own column, and
// is not taken for an item id.
test('the used names come from the tag and the companion columns', async () => {
  const asked: string[] = [];
  const pool = {
    query: (sql: string) => {
      asked.push(sql);
      const column = sql.includes('unnest(tags)') ? 'tags' : 'companions';
      return Promise.resolve({ rows: [{ name: `${column}-one` }, { name: `${column}-two` }] });
    },
  } as unknown as Pool;
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/items/names');
    assert.equal(status, 200);
    assert.deepEqual(data, {
      tags: ['tags-one', 'tags-two'],
      companions: ['companions-one', 'companions-two'],
    });
    assert.equal(asked.length, 2);
    assert.ok(asked.every((sql) => /GROUP BY lower\(name\)/.test(sql)));
  });
});
