import { request } from 'node:http';

import type { Pool } from 'pg';

import { createApp } from '../src/app.js';

type Call = (
  path: string,
  init?: { method?: string; body?: unknown; rawBody?: string },
) => Promise<{ status: number; data: Record<string, unknown> }>;

// node:http, not fetch: fetch refuses "bad ports" such as 5060, and a Windows PC whose
// ephemeral range starts at 1024 can hand those to listen(0).
function send(port: number, path: string, method: string, body?: string) {
  return new Promise<{ status: number; raw: string }>((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        agent: false,
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (raw += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, raw }));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

export async function withApi(
  pool: Pool,
  run: (call: Call) => Promise<void>,
  options: { today?: () => string } = {},
) {
  const server = createApp(pool, options).listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No TCP address');
    await run(async (path, init = {}) => {
      const body =
        init.rawBody ?? (init.body === undefined ? undefined : JSON.stringify(init.body));
      const { status, raw } = await send(address.port, path, init.method ?? 'GET', body);
      return { status, data: (raw ? JSON.parse(raw) : {}) as Record<string, unknown> };
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
