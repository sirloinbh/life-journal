import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer, type Socket } from 'node:net';
import { test } from 'node:test';

import { Pool } from 'pg';

import { CONNECT_TIMEOUT_MS, connectPool, STATEMENT_TIMEOUT_MS } from '../src/pool.js';
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

test('a connection error is logged instead of ending the process', async (t) => {
  const pool = connectPool('postgres://unused@127.0.0.1:1/unused');
  t.after(() => pool.end());
  const errors = captureErrors();
  t.after(errors.restore);
  const client = new EventEmitter();
  pool.emit('connect', client);
  client.emit('error', new Error('connection lost'));
  pool.emit('error', new Error('idle client lost'));
  assert.deepEqual(errors.logged, [
    JSON.stringify({ event: 'db_connection_error', message: 'connection lost' }),
  ]);
});

test('the pg error code is logged with the message', async (t) => {
  const pool = connectPool('postgres://unused@127.0.0.1:1/unused');
  t.after(() => pool.end());
  const errors = captureErrors();
  t.after(errors.restore);
  const client = new EventEmitter();
  pool.emit('connect', client);
  client.emit('error', Object.assign(new Error('terminating connection'), { code: '57P01' }));
  assert.deepEqual(errors.logged, [
    JSON.stringify({
      event: 'db_connection_error',
      message: 'terminating connection',
      code: '57P01',
    }),
  ]);
});

test('the pool sets a connect timeout and a statement timeout by default', async (t) => {
  const pool = connectPool('postgres://unused@127.0.0.1:1/unused');
  t.after(() => pool.end());
  assert.equal(pool.options.connectionTimeoutMillis, CONNECT_TIMEOUT_MS);
  assert.equal(pool.options.statement_timeout, STATEMENT_TIMEOUT_MS);
});

// A server that accepts the TCP connection and never answers, like a DB host that hangs.
async function silentServer(t: { after: (fn: () => Promise<void>) => void }) {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP address');
  return `postgres://unused:unused@127.0.0.1:${address.port}/unused`;
}

test(
  'a database that never answers fails a query within the connect timeout',
  { timeout: 10_000 },
  async (t) => {
    const pool = connectPool(await silentServer(t), { connectTimeoutMs: 300 });
    t.after(() => pool.end());
    const started = Date.now();
    await assert.rejects(pool.query('SELECT 1'), /timeout/i);
    assert.ok(Date.now() - started < 3_000, 'The query should fail soon after the connect timeout');
  },
);

test(
  'health answers 500 within seconds when the database never answers',
  { timeout: 10_000 },
  async (t) => {
    const pool = connectPool(await silentServer(t), { connectTimeoutMs: 300 });
    t.after(() => pool.end());
    const errors = captureErrors();
    t.after(errors.restore);
    const started = Date.now();
    await withApi(pool, async (call) => {
      const { status } = await call('/api/health');
      assert.equal(status, 500);
    });
    assert.ok(Date.now() - started < 3_000, 'The request should not wait for the OS TCP timeout');
  },
);

test('the database cancels a statement that runs past the limit', { skip: !url }, async (t) => {
  const pool = connectPool(url, { statementTimeoutMs: 200 });
  t.after(() => pool.end());
  await assert.rejects(pool.query('SELECT pg_sleep(5)'), { code: '57014' });
  const { rows } = await pool.query<{ ok: number }>('SELECT 1 AS ok');
  assert.equal(rows[0]!.ok, 1, 'The connection is usable after the cancel');
});

test('the API keeps answering after its idle connection is dropped', { skip: !url }, async (t) => {
  const pool = connectPool(url);
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
