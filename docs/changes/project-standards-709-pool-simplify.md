# Use the managed createPool log hook (project-standards#709)

- `src/pool.ts` no longer adds its own per-connection listener: the managed `createPool` (project-standards#834) now listens on every connection, so `connectPool` only passes the structured `db_connection_error` log line to it.
- `openapi.ts` already uses the managed builder (#161/#162); nothing else changes.
- Verification: typecheck, eslint and prettier. The connection-loss test runs in CI.
