# #142 Fail fast when the database is unreachable

- Issue: [#142](https://github.com/sirloinbh/life-journal/issues/142) (parent epic #138)
- Branch: `fix/142-db-fail-fast`

## Purpose

`connectPool` set no `connectionTimeoutMillis` (pg default 0 = wait forever), so a DB host that accepts TCP but never answers held each request, and a pool client, until the OS TCP timeout; a burst could take all 10 clients. No statement timeout bounded a runaway query, and the connection error log kept only the message.

## Changes — 2026-11-23

- `backend/src/pool.ts`:
  - `connectionTimeoutMillis: 5000` (`CONNECT_TIMEOUT_MS`): a request that cannot get a connection fails within 5 seconds and the error handler answers 500.
  - `statement_timeout: 15000` (`STATEMENT_TIMEOUT_MS`): PostgreSQL cancels a statement after 15 seconds (`57014`) and the connection stays usable. A server-side timeout was chosen over pg's client-side `query_timeout`, which rejects the promise but leaves the query running on the connection.
  - `connectPool(url, { connectTimeoutMs, statementTimeoutMs })` lets tests use short limits.
  - The `db_connection_error` log line now also carries the pg error `code` when the error has one (for example `57P01`). `JSON.stringify` drops an undefined code, so a plain `Error` logs the same line as before.
- The migration runner (`standard/migrate.ts`) opens its own `Client`, so a long migration is not cut by the statement timeout.

## Tests

`backend/test/pool.test.ts`:

- The error code is logged with the message.
- The default pool has the 5 s connect timeout and the 15 s statement timeout.
- Against a local TCP server that accepts and never answers (a hung DB host): `pool.query` rejects with a timeout, and `/api/health` answers 500, both well under 3 s with a 300 ms limit. Each has a 10 s test timeout so a regression fails instead of hanging.
- With `TEST_DATABASE_URL`: `SELECT pg_sleep(5)` with a 200 ms limit rejects with `57014`, and the next query on the pool succeeds.
- Without `connectionTimeoutMillis` (line removed temporarily) the two hung-host tests fail after 10 s; with it they pass.

## Verification — 2026-11-23

- `npm run check` with `TEST_DATABASE_URL` set to a throwaway PostgreSQL 17 (`postgres:17-alpine`, `journal_test`, migrations 001-008 applied by the runner): pass. Backend 171 passed, 0 skipped; frontend 261 passed, 3 skipped (existing); contract 3 passed; skills 4 passed; build passed.
- No screen change, so no browser check.
