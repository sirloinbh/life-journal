import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { serviceDate } from '../src/app.js';
import { withApi } from './helpers.js';

const pool = (query: () => Promise<unknown>) => ({ query }) as unknown as Pool;

test('health reports the service and the injected service date when the DB answers', async () => {
  await withApi(
    pool(async () => ({ rows: [] })),
    async (call) => {
      const { status, data } = await call('/api/health');
      assert.equal(status, 200);
      assert.deepEqual(data, { ok: true, service: 'life-journal', today: '2026-10-19' });
    },
    { today: () => '2026-10-19' },
  );
});

test('a DB failure becomes a Korean 500 without leaking the error', async () => {
  const original = console.error;
  console.error = () => {};
  try {
    await withApi(
      pool(async () => {
        throw new Error('password authentication failed for user secret');
      }),
      async (call) => {
        const { status, data } = await call('/api/health');
        assert.equal(status, 500);
        assert.deepEqual(data, { error: 'Server error' });
      },
    );
  } finally {
    console.error = original;
  }
});

test('unknown API paths return a Korean 404 JSON body', async () => {
  await withApi(
    pool(async () => ({ rows: [] })),
    async (call) => {
      const { status, data } = await call('/api/does-not-exist');
      assert.equal(status, 404);
      assert.equal(data.error, 'API not found');
    },
  );
});

test('API requests beyond 600 per minute get a 429, and the health check is not counted', async () => {
  await withApi(
    pool(async () => ({ rows: [] })),
    async (call) => {
      for (let request = 1; request <= 600; request++) {
        const { status } = await call('/api/does-not-exist');
        assert.equal(status, 404, `request ${request}`);
      }
      assert.equal((await call('/api/health')).status, 200);
      const { status, data } = await call('/api/does-not-exist');
      assert.equal(status, 429);
      assert.deepEqual(data, { error: 'Too many requests. Try again in a minute.' });
    },
  );
});

test('service date follows Asia/Seoul across the UTC day boundary', () => {
  assert.equal(serviceDate(new Date('2026-10-18T14:59:59Z')), '2026-10-18');
  assert.equal(serviceDate(new Date('2026-10-18T15:00:00Z')), '2026-10-19');
});

test('every response has an X-Request-Id, and a valid incoming one is kept (#134)', async (t) => {
  const logged = t.mock.method(console, 'log', () => {});
  await withApi(
    pool(async () => ({ rows: [] })),
    async (call) => {
      const made = await call('/api/health');
      assert.match(String(made.headers['x-request-id']), /^[\w.-]{1,128}$/);
      const kept = await call('/api/health', { headers: { 'x-request-id': 'req-from-nginx-1' } });
      assert.equal(kept.headers['x-request-id'], 'req-from-nginx-1');
      // A 404 carries one too.
      const missing = await call('/api/does-not-exist');
      assert.equal(missing.status, 404);
      assert.ok(missing.headers['x-request-id']);
    },
  );
  assert.ok(
    logged.mock.calls.some((c) =>
      String(c.arguments[0]).includes('"requestId":"req-from-nginx-1"'),
    ),
  );
});
