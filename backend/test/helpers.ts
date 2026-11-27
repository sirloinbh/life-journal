import { createServer, type IncomingHttpHeaders, request } from 'node:http';

import { Pool, type PoolConfig } from 'pg';

import { createApp } from '../src/app.js';
import { pgTypes } from '../src/pool.js';
import { listenLocally } from './standard/api.js';

// A pool on the test DB with the app's type parsers (#143): DATE as YYYY-MM-DD, BIGINT as a number.
export function testPool(config: PoolConfig = {}) {
  return new Pool({ connectionString: process.env.TEST_DATABASE_URL, types: pgTypes, ...config });
}

type Call = (
  path: string,
  init?: { method?: string; body?: unknown; rawBody?: string; headers?: Record<string, string> },
) => Promise<{ status: number; data: Record<string, unknown>; headers: IncomingHttpHeaders }>;

// node:http, not fetch: fetch refuses "bad ports" such as 5060, and a Windows PC whose
// ephemeral range starts at 1024 can hand those to listen(0).
function send(
  port: number,
  path: string,
  method: string,
  body?: string,
  extraHeaders: Record<string, string> = {},
) {
  return new Promise<{ status: number; raw: string; headers: IncomingHttpHeaders }>(
    (resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port,
          path,
          method,
          agent: false,
          headers: {
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...extraHeaders,
          },
        },
        (res) => {
          let raw = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => (raw += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, raw, headers: res.headers }));
          res.on('error', reject);
        },
      );
      req.on('error', reject);
      req.end(body);
    },
  );
}

export async function withApi(
  pool: Pool,
  run: (call: Call) => Promise<void>,
  options: Parameters<typeof createApp>[1] = {},
) {
  const server = createServer(createApp(pool, options));
  const port = await listenLocally(server);
  try {
    await run(async (path, init = {}) => {
      const body =
        init.rawBody ?? (init.body === undefined ? undefined : JSON.stringify(init.body));
      const { status, raw, headers } = await send(
        port,
        path,
        init.method ?? 'GET',
        body,
        init.headers,
      );
      return { status, data: (raw ? JSON.parse(raw) : {}) as Record<string, unknown>, headers };
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
