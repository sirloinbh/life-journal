# #158 Move the screens that load data to the shared query layer

- Issue: [#158](https://github.com/sirloinbh/life-journal/issues/158) (parent epic #159), step 2 of 2
- Branch: `feat/158-shared-query-layer`
- Step 1: `features.query: true` (sirloinbh/project-standards#1013, PR #1014) and sync PR #181, which brought `frontend/src/lib/query.ts` and the `@tanstack/react-query` 5.104.1 install ([158-install-react-query.md](158-install-react-query.md))

## Changes — 2026-11-23

- `frontend/src/app.tsx`: `App` provides one `QueryClient` (`createQueryClient()` from `lib/query.ts`) through `QueryClientProvider`. It takes an optional `queryClient`, which only tests pass.
- `frontend/src/items-table.tsx`: the hand-written page loop (`Result`/`More` state, request counter, `current` flags) is replaced by `useInfiniteQuery` with one key per table address (`itemPagesKey(search)`). The shared layer has no paged hook, so the table uses React Query's own one with `fetchItemPage` as the page function. Behaviour from #144 is kept: the count shows the total (`133 items · showing 100`); "Load more" appends the next page; a failed "Load more" shows its error next to the button. The rows stay on screen while a new address loads and after it fails, but then offer no "Load more". "Try again" refetches the pages already loaded.
- `frontend/src/bucket-list.tsx`: `useItems` reads every page through `useQuery` (`allItemsKey`, `fetchAllItems`); a change the server confirmed goes into the cache with `setQueryData`, and a reload cancels one still on its way. Saves, reopen and delete go through `useApiMutation`. The form still closes as soon as the save answers and the list reloads in the background (no `invalidate`, which would make the save wait for the reload).
- `frontend/src/terms-study.tsx`: the terms load through `useApiQuery`, and the learned mark through `useApiMutation`. A mark confirmed while the list is on its way still asks for the list again (`invalidateQueries`, which cancels the older request).
- `frontend/src/item-pages.ts`: the query keys (`allItemsKey`, `itemPagesKey`; both start with `/api/items`, so invalidating that refreshes both screens) and an abort `signal` for `fetchItemPage` and `fetchAllItems`.
- `frontend/src/settled-error.ts` (new): `useSettledError` keeps the error of the last finished load while a retry runs. React Query clears the error when the retry starts. Without this, the "Try again" button (and the keyboard focus on it) would disappear until the answer.
- Not moved: the header's server check (`useHealth` in `app.tsx`) reads the HTTP status of a non-JSON answer for its message, which `requestJson` does not give, so it keeps its own `fetch`.

## New behaviour from the shared client

- Data counts as fresh for 30 s, a window that gets focus again refreshes stale data, and a failed load is retried once when the server was unreachable, timed out or answered 5xx (central `createQueryClient`, ADR-0027).
- Leaving a screen cancels its request still on its way.

## Tests

- `frontend/src/test/app.tsx`: `openAt` renders the app with a fresh `QueryClient` per test, without retries, always stale and without focus refetches, so each fake answer is used once as before.
- `frontend/src/items-table.test.tsx`: new "leaving the table cancels a list request still on its way (#158)"; it fails when `fetchItemPage` does not pass the signal (checked).
- `frontend/src/terms-study.test.tsx`: "more clicks during a mark on its way send nothing" now waits one microtask before counting the requests, because a mutation starts its request a microtask after the click; it still checks that only one request is sent.
- All earlier table, bucket-list and terms tests pass unchanged: the #144 paging tests, the stale-answer tests, and the retry-keeps-focus tests.

## Browser check — 2026-11-23

Real API (`server.ts` on a temporary port with the throwaway DB, 130 reading and 3 travel items) and the Vite dev server on a temporary port, Playwright with the installed Chrome, at 390×844 and 1440×900:

- Table: `133 items · showing 100` with 100 rows; "Load more" asked `?offset=100`, then 133 rows, `133 items`, and the button was gone.
- Bucket list: one `?limit=500` request, `· 130 items` for reading; adding an item sent one `POST` and one list reload, and the list read `· 131 items` with the new item.
- Terms: a learned mark (`PUT .../learned`) was still checked after a page reload, then taken back (`DELETE`).
- No horizontal page overflow on any of the three screens, and no console errors.

## Verification — 2026-11-23

- `npm run check` with `TEST_DATABASE_URL` set to a throwaway PostgreSQL 17 (`journal_test`, migrations 001-009): pass. Backend 191 passed, 0 skipped; frontend 314 passed, 3 skipped (existing); contract 3; skills 4; build.
- `npm run knip` (with `TEST_DATABASE_URL`, as in CI): no findings.

## Review — 2026-11-23

- Round 1 (self-review of head `7cf12c8`): two findings from the 30 s cache and the focus refresh, fixed in the next commit with regression tests (both fail without their fix, checked).
  - `issue:` a change on the bucket list did not reach the table within the cache time: the table's pages are cached under their own keys, and a fresh cached query is not asked again when the table opens. The item writes now pass `invalidate: [tablePagesKey]` to `useApiMutation`, which marks every cached table address stale. The table is not on screen then, so the save does not wait for it. Test "a change on the bucket list shows on the table at once, within the cache time (#158)" (bucket-list tests, with the app's 30 s cache).
  - `issue:` a refresh in the background (window focus, `refetchQueries`) counted as loading, so the table hid the count and "Load more", which could drop the keyboard focus on that button. Loading now means the address has no list yet or is being tried again after a failure. Test "a refresh in the background keeps the count and "Load more" with the focus (#158)".
  - `openAt` (test helper) takes an optional `staleTime` and returns its query client for these tests.
  - Checked without findings: the bucket list and terms keep their list on screen during a background refresh (their loading shows only without data); `useSettledError` keeps "Try again" during a retry; mutations still reject with `RequestError`, so the 404 handling and form errors are unchanged.
  - After the fixes, with the same `TEST_DATABASE_URL`: `npm run check` pass (backend 191 passed, 0 skipped; frontend 316 passed, 3 skipped (existing); contract 3; skills 4; build); `npm run lint` and `npm run knip` pass.
