# Report the real failure when the health check fails

- Issue: [#152](https://github.com/sirloinbh/life-journal/issues/152) (epic #137 Reliable bucket list screens)
- Branch: `fix/152-health-failure`

## Problem

`useHealth` in `frontend/src/app.tsx` parsed `response.json()` before checking `response.ok`. A proxy error page (nginx HTML 502/504) made the parse throw, and the `.catch` said "Cannot reach the server" although the server had answered. `app.test.tsx` did not test a failed request or a 200 answer without `today`.

## Change

- `app.tsx`: the body is read with `response.json().catch(() => null)`, so an HTML page no longer reaches the network `.catch`. Then:
  - `ok` with a string `today` → "Server connected · <date>" (unchanged).
  - not `ok` with a JSON `error` → that message (unchanged).
  - not `ok` without one (HTML page, empty body) → "Cannot check the server status (HTTP <status>)" (new).
  - `ok` without `today` → "Cannot check the server status" (unchanged).
  - `fetch` rejects → "Cannot reach the server" (unchanged, now only for real network failures).

Wording: the status text reuses the existing fallback and adds the status (recommended option A of the decision asked to the coordinator, see "Check before merging" in the PR).

The centrally managed `health.ts` also exports a `useHealth` that retries every 10 s; switching `app.tsx` to it would change the "200 without `today`" outcome and add polling, so it is out of this card's scope.

## Verification

- Tests in `app.test.tsx`: "a server that cannot be reached says so", "a proxy error page (HTML 502/504) shows its status", "a 200 answer without the date is not reported as connected". With the `origin/main` `app.tsx` the two HTML cases failed ("Cannot reach the server"); the other two are new coverage of unchanged behavior. `npm run test -w frontend -- src/app.test.tsx`: 8 passed.
- Browser (Playwright Chromium, frontend dev server on a temporary port with a temporary stub API whose health answer can be switched; frontend-only change): at 1440×900 an HTML 502 showed "Cannot check the server status (HTTP 502)" as the alert under the page title. At 390×844: HTML 502 → that text, 200 `{}` → "Cannot check the server status", JSON 503 → the server message "A server error occurred", 200 with `today` → "Server connected · 2026-11-23" as a status. No horizontal page overflow.
- `npm run check`: see below.

### `npm run check` (2026-11-23)

- Pass. Format, lint, contract 3 passed, typecheck, backend 148 passed and 29 DB tests skipped (no `TEST_DATABASE_URL`, so the DB is not verified), frontend 273 passed and 3 skipped, skills 4 passed, build.

## Review round 1 — 2026-11-23

Self-review (std-code-review section 8). Decision: approve, no blocking comments. Non-blocking notes left as they are: a 200 answer with an `error` field and no `today` now shows the fallback instead of that `error` (the route never sends it), and adopting the managed `health.ts` hook is a possible later cleanup outside this card.

## Decision — 2026-11-23

- The decision was answered on 2026-11-23: option A, 'Cannot check the server status (HTTP <status>)', recorded on #152.
