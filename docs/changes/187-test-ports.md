# Stop backend tests from failing on ports fetch refuses

- Issue: [#187](https://github.com/sirloinbh/life-journal/issues/187) (epic #138 Safer backend and database)
- Branch: `fix/187-test-ports`

## Problem

Four backend test servers called `createApp(...).listen(0, '127.0.0.1')` and then used `fetch`. On a Windows PC whose dynamic port range starts at 1024 (the one this was seen on: 1024–15000), `listen(0)` can return a port `fetch` refuses, such as 6000 or 10080, and the test fails with `TypeError: fetch failed` (cause `bad port`). It happened once in `npm run check` during PR #184.

## Change

- `sign-in.test.ts`, `ai-tools-binding.test.ts`, and both servers in `ai-tools.integration.test.ts` now start with `createServer(createApp(...))` and `listenLocally(server)` from the managed `standard/api.ts`, which closes a listener on a refused port and asks for another. The `server.address()` checks they no longer need are gone.
- `helpers.ts` `withApi` uses `listenLocally` too. It talks to the server with `node:http`, which has no bad-port list, so it was not failing; it changes only so every backend test server starts the same way.
- Left as is: `pool.test.ts` `silentServer` is a raw TCP server that only `pg` connects to, never `fetch`, so a refused port cannot happen there. `grep -rn "listen(0" backend/test` now lists `standard/api.ts` (the helper and its comment), the `helpers.ts` comment about `node:http`, and that `pool.test.ts` line.

No new test: `listenLocally` itself is covered by `standard-api.test.ts` (managed), and a refused port cannot be forced from `listen(0)`.

## Verification

- `npm run test -w backend` three times in a row: 183 tests, 153 passed, 0 failed, 30 skipped each time. The skipped ones are the DB integration tests (no `TEST_DATABASE_URL` in this lane), which include both `ai-tools.integration.test.ts` tests, so those two changed servers were type-checked but not run here; CI runs them with its test DB.
- `npm run typecheck`: pass.
- `npm run check`: see below.

### `npm run check` (2026-11-23)

- Pass. Format, lint, contract 3 passed, typecheck, backend 153 passed and 30 DB tests skipped, frontend 293 passed and 3 skipped, skills 4 passed, build.
