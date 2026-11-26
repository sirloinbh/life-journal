# #212 Show monthly and yearly statistics of completed items

- Issue: [#212](https://github.com/sirloinbh/life-journal/issues/212)
- Branch: `feat/212-yearly-stats`
- Counting rules: the coordinator did not answer the decision question, so the issue's recommendation was applied and recorded on the issue ([comment](https://github.com/sirloinbh/life-journal/issues/212#issuecomment-7178066267)): only done items count, by `completed_date`; spending is the sum of `cost_krw` of those items; unrated items are left out of averages; ties in the top list go to the later completion (then the higher id).

## Purpose

Completed date, cost, rating, and category are stored on every item, but nothing adds them up.

## Changes

### Commit: the statistics API

- `backend/src/stats.ts` (new): `GET /api/stats?year=YYYY` answers `{ year, completed, spendingKrw, months, categories, topRated }` for the done items completed from January 1 up to January 1 of the next year (PostgreSQL date math). Without `year` it uses this year in Asia/Seoul; a year that is not four digits from 0001 (or a repeated or unknown parameter) answers 400 before any query.
  - `months`: all 12 months in order, each with its total and a count per category (every category, 0 when none).
  - `categories`: every category in menu order with `completed`, `rated`, `averageRating` (rounded to two decimals, `null` with no ratings), and `spendingKrw` (items with no cost add nothing).
  - `topRated`: up to 5 rated items, by rating, then the later completion, then the higher id.
- `backend/src/app.ts`, `backend/src/openapi.ts`, `docs/openapi.json`: the route is mounted at `/api/stats` and documented.

### Commit: the statistics screen

- `frontend/src/stats.tsx` (new), `frontend/src/app.tsx`: a "Statistics" menu entry and the page `/stats/:year` (an address without a valid year goes to this year in Asia/Seoul). Previous year, "This year", and next year are links that stay mounted, so the one pressed keeps the keyboard focus.
  - Two summary cards: items completed and spending.
  - "Completed per month": one bar per month with its number written next to it (a single series in the primary color, so no legend), and below it the text equivalent, a table of each month by category with totals.
  - "By category": completed, average rating ("No ratings" when none), and spending per category. Its cells are tight and its headings may wrap, so it fits 390 px without scrolling.
  - "Top rated": up to five items with category, rating, and completed date, each linking to the item on the bucket list.
  - A year with nothing completed shows the cards with zeros and a sentence instead of the sections; a failed load shows the error and "Try again".

## Tests

- `backend/test/stats.test.ts` (new, no DB): a two- or five-digit year, year 0000, a month, two years, and an unknown filter are refused with 400 without touching the database; without `year` the queries ask for the year of `today`, and an empty year still lists 12 months and 6 categories with zeros and `null` averages.
- `backend/test/stats.integration.test.ts` (new, needs `TEST_DATABASE_URL`, own schema `test_stats`): seeded items completed on Jan 1 and Dec 31, 2026 count, while Dec 31, 2025, Jan 1, 2027, and a wishlist item with a cost do not; the per-month totals and per-category counts, the spending total, the averages (an unrated film left out, 2 + 2.5 + 2.5 → 2.33), and the top 5 with both tie rules match; 2025 and 9999 answer too.
- `backend/test/openapi.test.ts`: the router list knows `/api/stats` (next to `/api/calendar` after merging main).
- `frontend/src/stats.test.tsx` (new): opens on this year (Nov 10, 2026 in Seoul) and shows the counts, spending, month bars, the month-by-category table, the category table (including a category with no ratings), and the top item with its link; switching to the previous year changes the numbers and keeps the focus on the link; an empty year says so and "This year" returns; an invalid year address goes to this year; a failed load offers a retry.

## Verification

- With the shared lock and `TEST_DATABASE_URL` on the local `journal_test`: `tsx --test backend/test/stats.test.ts backend/test/stats.integration.test.ts backend/test/openapi.test.ts`: 13 passed, 0 skipped.
- `vitest run src/stats.test.tsx src/app.test.tsx`: 13 passed.
- Browser: Vite on 127.0.0.1:5214 with `/api/*` stubbed by Playwright (34 items in 2026, five top items with long titles), Chrome.
  - 1440×900: cards side by side, bars capped at a readable width with their numbers, both tables without scrolling, no horizontal page overflow.
  - 390×844: cards stacked, no horizontal page overflow. The first run showed the category table scrolling sideways (382 px in 341 px); after tightening it fits (341 in 341). The month-by-category table (8 columns) scrolls inside its own region, as the items table does.
  - Keyboard: Enter on "Previous year" moves to 2025 ("Nothing was completed in 2025.") and the focus stays on the link.
  - Console: only 403s for the Pretendard font files (this worktree's `node_modules` is outside the Vite allow list); not related.
- The branch merged `origin/main` (#213) before the screen commit: `app.ts`, `openapi.ts`, and `openapi.test.ts` kept both routes, and `docs/openapi.json` was regenerated (8 paths).
- `npm run check` on the shared `journal_test` failed once in `items-check-names.integration.test.ts`: that DB already had another lane's unmerged `010_item_tags_companions.sql` (two extra CHECKs), and `db:migrate` refused because the file is not on this branch. Not caused by this change.
- `npm run check` with `TEST_DATABASE_URL` on a fresh lane DB (`journal_test_lane2`, migrations 001-009 of this branch): pass. Backend 209 passed, 0 skipped; frontend 332 passed, 3 skipped (existing); contract 3; skills 4; build passed.

## Review round 1

- Merged `origin/main` (#215 item tags with migration 010, #218 terms quiz) with no conflicts; `docs/openapi.json` was already current.
- `npm run check` with `TEST_DATABASE_URL` on a fresh lane DB (migrations 001-010): pass. Backend 218 passed, 0 skipped; frontend 357 passed, 3 skipped (existing); contract 3; skills 4; build passed.
- No blocking findings. Nits left as they are: the three statistics queries run in parallel outside one snapshot (a write between them could make one answer slightly inconsistent; one user, read-only, no harm); while a new year loads after a failed one, the old error stays until the new answer arrives (the shared `useSettledError` behavior, also on the calendar).
