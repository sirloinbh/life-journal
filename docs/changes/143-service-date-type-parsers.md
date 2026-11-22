# #143 Use the standard serviceDate and set pg type parsers in pool setup

- Issue: [#143](https://github.com/sirloinbh/life-journal/issues/143) (parent epic #138)
- Branch: `chore/143-service-date-type-parsers`

## Purpose

`backend/src/app.ts` kept its own copy of `serviceDate`/`serviceTimeZone`, which the synced `standard/http.ts` already exports, and called `types.setTypeParser(...)` and `setInt8Parser(types)` as an import side effect. That changed pg's global parser registry for every script or test that imported `app.ts`, and test pools only parsed DATE and BIGINT correctly because some file had imported `app.ts` first.

## Changes — 2026-11-23

- `backend/src/app.ts`: deletes the local `serviceDate`/`serviceTimeZone` and imports `serviceDate` from `standard/http.ts`. No `pg` value import and no side effect remain.
- `backend/src/pool.ts`: `pgTypes`, a pg `TypeOverrides` with the DATE (1082 → `YYYY-MM-DD` text) parser and the managed `setInt8Parser` (BIGINT → safe JS number, ADR-0025). `connectPool` passes it as the pool's `types`, so only this app's pools use the parsers and pg's global registry is untouched.
- `backend/test/helpers.ts`: `testPool(config)` opens a pool on `TEST_DATABASE_URL` with `pgTypes`. `db.integration.test.ts` and `ai-tools.integration.test.ts` use it instead of `new Pool({ connectionString })`.
- `backend/test/health.test.ts`: imports `serviceDate` from `standard/http.ts`.
- `openapi-cli.ts` is unchanged; it imports `app.ts`, which no longer has the side effect.

## Tests

`backend/test/pg-types.test.ts` (new):

- After importing `app.ts`, pg's global DATE parser still returns a `Date` and the global int8 parser a string.
- `pgTypes` keeps DATE as text, turns `42` into the number 42, and throws for `9007199254740993` (outside the safe integer range).
- With `TEST_DATABASE_URL`: a `connectPool` pool returns `{ day: '2026-11-23', id: 42 }` for `SELECT DATE '2026-11-23', 42::bigint`.
- With `app.ts` from `origin/main` the first test fails; with this change it passes.

The existing DB integration tests (dates and ids in item responses) now run on `testPool()`, so they check the per-pool parsers.

## Verification — 2026-11-23

- `rg "setTypeParser|function serviceDate" backend/src/app.ts`: no match.
- Backend tests with `TEST_DATABASE_URL` set to a throwaway PostgreSQL 17 (`journal_test`, all migrations applied): 176 passed, 0 skipped.
- `npm run check` with that `TEST_DATABASE_URL`: pass. Backend 176 passed, 0 skipped; frontend 264 passed, 3 skipped (existing); contract 3 passed; skills 4 passed; build passed. The contract check covers the OpenAPI output that `openapi-cli.ts` generates from `app.ts`.
- `npm run knip`: no finding in the changed files (it still lists the existing `e2e/smoke.spec.ts` and `@axe-core/playwright` items, which are not part of this card).
- No screen change, so no browser check.

## Review — 2026-11-23

- Round 1 (self-review of head `6a54b19`): no findings that need a change, so no second round.
  - `TypeOverrides` falls back to pg's global parsers for every type it does not override (`node_modules/pg/lib/type-overrides.js`), so other types parse as before.
  - The only other pg connection in `src` is the migration runner's `Client`, which never imported `app.ts` and so never had the parsers; the AI tool routes and `listItems` use the pool passed from `server.ts` (`connectPool`); tests with stub pools do not reach pg.
  - `items-check-names.integration.test.ts` (merged in #188) still opens `new Pool` directly; it only reads constraint names, so it does not need the parsers.
