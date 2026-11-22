# #141 Bind the dev API to localhost when sign-in is off

- Issue: [#141](https://github.com/sirloinbh/life-journal/issues/141) (parent epic #138)
- Branch: `fix/141-dev-api-localhost`

## Purpose

The code review of 2026-11-18 found that `server.ts` always listened on `0.0.0.0`, so a host run without the shared sign-in answered every network interface without authentication.

## What was already done

The central sync for project-standards#898 ([record](project-standards-898-listen-host.md)) already changed `server.ts` to `listen(port, listenHost(auth !== undefined))`: `127.0.0.1` without the sign-in, `0.0.0.0` with it, and `HOST` overrides. This PR finishes the remaining tasks of the card.

## Changes — 2026-11-23

- `backend/src/server.ts`: after `listen`, logs one JSON line with the address the server really bound, the port, and whether the sign-in is on: `{"event":"api_listening","host":"127.0.0.1","port":3104,"signIn":false}`. It replaces `API http://localhost:<port>`, which said nothing about the interface or the sign-in.
- `.env.example`: adds `AUTH_DISABLED=1`. Without it a `.env` copied from the example made `npm run dev -w backend` refuse to start (`sharedAuth()` requires `NODE_ENV=development|test` or `AUTH_DISABLED=1` when `AUTH_INTERNAL_URL` is unset), and the old comment wrongly said "unset, the API runs open". compose lists the API environment explicitly and does not pass `AUTH_DISABLED`, so the container is unchanged.

## Tests

`backend/test/server-listen.test.ts` (new): starts the real `src/server.ts` in a child process with `AUTH_DISABLED=1`, `PORT=0`, and no `AUTH_INTERNAL_URL`/`HOST`, and checks that the `api_listening` line reports host `127.0.0.1`, `signIn: false`, and a real port.

- With `server.ts` from `origin/main` the test fails (`No api_listening line`); with this change it passes.

## Verification — 2026-11-23

- Host run with `AUTH_DISABLED=1 PORT=3494`: the log line says `127.0.0.1`, `netstat -ano` shows `TCP 127.0.0.1:3494 ... LISTENING` only, and `/api/health` answered 200.
- Host run with `AUTH_INTERNAL_URL` set (`PORT=3495`): the log line says `0.0.0.0` and `signIn: true`, and `netstat` shows `0.0.0.0:3495`.
- Container: not run (building the image needs the user's GitHub Packages token). The container sets `AUTH_INTERNAL_URL`, so it still binds `0.0.0.0` and the compose health check (`fetch('http://127.0.0.1:3104/api/health')`) reaches it; this PR does not change the host choice.
- `npm run check` with `TEST_DATABASE_URL` set to a throwaway PostgreSQL 17 (`postgres:17-alpine`, `journal_test`, migrations 001-008 applied by the runner): pass. Backend 167 passed, 0 skipped; frontend 261 passed, 3 skipped (the existing skipped frontend tests); contract 3 passed; skills 4 passed; build passed.

## Review — 2026-11-23

- Round 1 (self-review of head `1f23427`): one finding, fixed in the next commit. `issue:` the test parsed the last stdout chunk even when it ended in the middle of the JSON line, so a split chunk could throw in the `data` handler. It now only looks at complete lines. Re-ran `server-listen.test.ts`, prettier, and eslint: pass. No other findings (bind logic unchanged, log uses the real bound address, `.env.example` line is not passed into the container).
- Round 2 (head `23214a7`): the round 1 fix is applied, and the full diff has no further findings.
