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
- Backend tests with `TEST_DATABASE_URL` set to a throwaway PostgreSQL 17 (`journal_test`, all migrations applied): see the verification section.
