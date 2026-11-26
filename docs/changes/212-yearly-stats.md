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

## Tests

- `backend/test/stats.test.ts` (new, no DB): a two- or five-digit year, year 0000, a month, two years, and an unknown filter are refused with 400 without touching the database; without `year` the queries ask for the year of `today`, and an empty year still lists 12 months and 6 categories with zeros and `null` averages.
- `backend/test/stats.integration.test.ts` (new, needs `TEST_DATABASE_URL`, own schema `test_stats`): seeded items completed on Jan 1 and Dec 31, 2026 count, while Dec 31, 2025, Jan 1, 2027, and a wishlist item with a cost do not; the per-month totals and per-category counts, the spending total, the averages (an unrated film left out, 2 + 2.5 + 2.5 → 2.33), and the top 5 with both tie rules match; 2025 and 9999 answer too.
- `backend/test/openapi.test.ts`: the router list knows `/api/stats`.

## Verification

- With the shared lock and `TEST_DATABASE_URL` on the local `journal_test`: `tsx --test backend/test/stats.test.ts backend/test/stats.integration.test.ts backend/test/openapi.test.ts`: 13 passed, 0 skipped.
