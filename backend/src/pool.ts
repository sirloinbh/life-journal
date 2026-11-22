import { Pool } from 'pg';

import { createPool } from './standard/db.js';

// #142: a DB that cannot be reached fails a request within seconds instead of holding it (and a pool client) until the
// OS TCP timeout, and the server cancels a runaway query. The migration runner opens its own client, so a long
// migration is not cut by these limits.
export const CONNECT_TIMEOUT_MS = 5_000;
export const STATEMENT_TIMEOUT_MS = 15_000;

// The managed createPool listens on every connection (idle or checked out). Its log line is replaced by one
// structured line that carries only the event, the message, and the pg error code (when there is one), so nothing
// about the connection reaches the log.
export function connectPool(
  connectionString: string | undefined,
  limits: { connectTimeoutMs?: number; statementTimeoutMs?: number } = {},
) {
  return createPool(
    new Pool({
      connectionString,
      connectionTimeoutMillis: limits.connectTimeoutMs ?? CONNECT_TIMEOUT_MS,
      statement_timeout: limits.statementTimeoutMs ?? STATEMENT_TIMEOUT_MS,
    }),
    (_message, error) =>
      console.error(
        JSON.stringify({
          event: 'db_connection_error',
          message: error.message,
          code: (error as { code?: unknown }).code,
        }),
      ),
  );
}
