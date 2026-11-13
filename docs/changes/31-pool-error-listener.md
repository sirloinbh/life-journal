# #31 Keep the API process alive when a DB connection drops

- Issue: [#31](https://github.com/sirloinbh/life-journal/issues/31)
- Branch: `fix/31-pool-error-listener`

## Purpose

When an idle pool connection dropped, an unhandled exception ended the API process and cut off other requests that were in progress. It was reproduced in the review of PR #30.

## Changes — 2026-10-31

- `backend/src/pool.ts`: added `createPool`, which logs the pool `error` event. The pool creates a new connection by itself for one that dropped.
- `backend/src/server.ts`: uses `createPool`.
- The same problem for a checked-out connection was already handled in `PATCH /api/items/:id` in #22.

## Tests

`backend/test/pool.test.ts`:

- Without a DB: a pool error is logged and does not end the process.
- With a real DB: `/api/health` still responds with 200 even after an idle connection is cut with `pg_terminate_backend`.

## Verification — 2026-10-31

Ran on Windows with a temporary PostgreSQL 17.11 (`journal_test`) set as `TEST_DATABASE_URL`.

- `npm run check`: pass. Backend 47 passed and 0 skipped, frontend 80 passed.
- `npm run knip`: pass.
- Ran `npm test -w backend` with the listener removed from the code, confirmed that the 2 new tests fail, and reverted the code. The errors are `Error: connection lost` and `terminating connection due to administrator command`, respectively.
- There is no screen change, so no browser check was done.

## Review — 2026-10-31

A separate agent reviewed head `a9ccbe1`. There were no code findings, and only one error wording in the verification record above was fixed. No code was changed, so there is no second review. The reviewer cut 5 idle connections with the real `server.ts` and confirmed that the process stayed alive and `/api/health` returned 200, and that the test does not fail under repeated or parallel runs.
