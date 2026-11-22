# #144 Add paging to the item list API

- Issue: [#144](https://github.com/sirloinbh/life-journal/issues/144) (parent epic #138)
- Branch: `feat/144-item-list-paging`
- Decision: option B, chosen by the user on 2026-11-23 ([issue comment](https://github.com/sirloinbh/life-journal/issues/144#issuecomment-7086650200)). Offset paging with `limit` 1-500 (default 100) and `offset`; response `{ items, nextOffset | null, total }`; the table gets "Load more" and keeps the total count; the bucket list keeps loading everything page by page.

## Purpose

`GET /api/items` had no `LIMIT`: every call returned every row with its details and review, and `q` scanned `details` on every row.

## Changes — backend, 2026-11-23

- `backend/src/items.ts`:
  - `listQuery` takes `limit` (whole number 1-500) and `offset` (whole number 0-1,000,000). Other values answer 400 with `Page size must be a whole number from 1 to 500` or `Offset must be a whole number from 0 to 1000000`.
  - `listSql` builds the page query (`LIMIT`/`OFFSET` as bound parameters) and a `count(*)` query with the same filters. The order already ended in `id DESC`, so every row has one place and pages neither repeat nor skip rows.
  - `listItemsPage` (the route) answers `{ items, nextOffset, total }`: `nextOffset` is the offset of the next page, or `null` on the last page or when the page is empty.
  - `listItems` (the AI tool `list_items`) keeps its answer `{ items }` and its own limit (default 50, at most 200), always from offset 0.
- `backend/src/openapi.ts` and `docs/openapi.json`: the summary describes the paging and the answer; `limit` and `offset` are listed as query parameters.

## Tests — backend

- `backend/test/items.test.ts`: 7 new 400 cases for `limit` (0, 501, `ten`, repeated) and `offset` (-1, 1.5, 1000001).
- `backend/test/db.integration.test.ts`, "the list answers pages with the next offset and the total (#144)": with 105 items, the default page has 100 items, `nextOffset` 100 and `total` 105, and the next page has the other 5 with `nextOffset` `null`. Pages of 30 of a filtered and sorted list (`category=reading&sort=costKrw&order=asc`, 101 items) take 4 calls and join into exactly the one-page list. A filter changes `total`; a page past the end is empty with `nextOffset` `null`; a filter with no match answers `total` 0.
- The first run caught a bad regex (the backslash of `\d` was lost while writing the file), so every `limit`/`offset` was refused; fixed before the commit.

## Changes — screens, 2026-11-23

Written after merging `origin/main` with the screens lane's #191 and #194 (both change `bucket-list.tsx` and `items-table.tsx`).

- `frontend/src/item-pages.ts` (new): `fetchItemPage(search, offset)` asks for one page and `fetchAllItems()` asks for pages of 500 (the API's largest) until `nextOffset` is `null`. An answer without the paging fields counts as the whole list, and a `nextOffset` that does not move forward ends the loop, so it always stops.
- `frontend/src/bucket-list.tsx`: loads every item with `fetchAllItems()`; grouping, counts, and the reload after a change work as before.
- `frontend/src/items-table.tsx`: the first page comes with the filters; "Load more" (under the table, only while there is a next page) appends the next page. The count shows the total: `133 items · showing 100` while pages are left, `133 items` when all are shown. A failed "Load more" shows the error next to the button, which stays to try again. A page that arrives after the filters changed is not appended.

## Tests — screens

- `frontend/src/items-table.test.tsx`: "Load more" appends the next page, the count keeps the total, and the second request is `status=wishlist&offset=2`; a failed "Load more" shows the error and works when tried again; a page that arrives after the filters changed is not appended (fails when the guard is removed).
- `frontend/src/bucket-list.test.tsx`: the bucket list asks `/api/items?limit=500` and then `...&offset=2`, and shows the items of both pages.
- The existing table and bucket-list tests, whose fake API answers only `{ items }`, pass unchanged.

## Browser check — 2026-11-23

Real API (`server.ts` on a temporary port with the throwaway DB, 130 reading and 3 travel items) and the Vite dev server on a temporary port, Playwright with the installed Chrome:

- 390×844 and 1440×900: the table first read `133 items · showing 100` with 100 rows; "Load more" asked `?offset=100`, then the table had 133 rows, read `133 items`, and the button was gone. The bucket list asked `?limit=500` and showed `· 130 items` for reading. No horizontal page overflow on either screen.
- The button is the default size, 36 px high with a mouse; the shared button grows to 44 px on touch screens (`pointer-coarse:min-h-11`).

## Verification — 2026-11-23

- `npm run check` with `TEST_DATABASE_URL` set to a throwaway PostgreSQL 17 (`postgres:17-alpine`, `journal_test`, migrations 001-009 applied): pass. Backend 191 passed, 0 skipped; frontend 297 passed, 3 skipped (existing); contract 3 passed; skills 4 passed; build passed.
- Browser e2e (`npm run test:e2e`) was not run locally because ports 3204/5304 are shared with the other lanes; CI runs it on the PR.

## Review — 2026-11-23

- Round 1 (self-review of head `67fd11d`): two findings, fixed in the next commit with regression tests.
  - `issue:` after a failed refresh on new filters, the table kept the old rows with the old `nextOffset`, so "Load more" would append a page of the new filters to the old rows. The failure now clears `nextOffset`; test "after a failed refresh the old rows offer no "Load more" of the new filters".
  - `issue:` a table address that already had `offset=` (typed by hand) made "Load more" send `offset` twice, which the API answers with 400. `fetchItemPage` now replaces it; test ""Load more" replaces an offset that is already in the address".
  - Checked without findings: the count query uses a copy of the filter parameters taken before `LIMIT`/`OFFSET` are added; the AI tool still answers `{ items }` from offset 0 with its own limit; ties are broken by `id`, so pages are stable.
  - `npm run check` after the fixes, with the same `TEST_DATABASE_URL`: pass. Backend 191 passed, 0 skipped; frontend 299 passed, 3 skipped (existing); contract 3; skills 4; build.
