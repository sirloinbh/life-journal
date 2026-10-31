import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { createPool } from '../src/pool.js';
import { withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

function captureErrors() {
  const original = console.error;
  const logged: string[] = [];
  console.error = (message: string) => logged.push(message);
  return {
    logged,
    restore: () => {
      console.error = original;
    },
  };
}

test('a pool error is logged instead of ending the process', async (t) => {
  const pool = createPool('postgres://unused@127.0.0.1:1/unused');
  t.after(() => pool.end());
  const errors = captureErrors();
  t.after(errors.restore);
  pool.emit('error', new Error('connection lost'));
  assert.deepEqual(errors.logged, [
    JSON.stringify({ event: 'db_pool_error', message: 'connection lost' }),
  ]);
});

test('the API keeps answering after its idle connection is dropped', { skip: !url }, async (t) => {
  const pool = createPool(url);
  const admin = new Pool({ connectionString: url });
  t.after(() => Promise.all([pool.end(), admin.end()]));
  const errors = captureErrors();
  t.after(errors.restore);
  const { rows } = await pool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
  await withApi(pool, async (call) => {
    await admin.query('SELECT pg_terminate_backend($1)', [rows[0]!.pid]);
    for (let attempt = 0; attempt < 100 && errors.logged.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(errors.logged.length, 1, 'The dropped connection should be logged');
    const { status, data } = await call('/api/health');
    assert.equal(status, 200);
    assert.equal(data.ok, true);
  });
});
