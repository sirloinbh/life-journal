# #27 Rate completed items with an overall and detailed ratings

- Issue: [#27](https://github.com/sirloinbh/life-journal/issues/27)
- Branch: `feat/27-item-ratings`

## Purpose

Leave an overall rating and a per-area detailed rating on completed items.

## Decision

Follow the user decision recorded in the issue comment.

- 5 points at most, in steps of 0.5.
- Detailed criteria: books (content, writing, afterglow), movies and shows (story, direction, acting), performances (acting, direction, stage, music), alcohol (aroma, taste, finish, value for money), travel (scenery, food, lodging, transport).
- The overall rating is given directly, and the average of the detailed ratings is shown only for reference.

The values decided during implementation are as follows.

- The lowest score is 0.5.
- Both the overall rating and the detailed ratings are optional.
- A rating can be set only on a completed item. If completion is cancelled, the rating is cleared too, and the confirmation dialog says so.

## Changes — 2026-10-31

- `database/migrations/003_item_ratings.sql`: `rating` and `sub_ratings` columns. The DB blocks the range of `rating` and the "completed items only" rule with `CHECK`. For `sub_ratings`, the DB blocks only that it is an object and the "completed items only" rule, and the API checks the keys and scores.
- `backend/src/items.ts`: rating validation, the per-area detailed criteria, save, and update.
- `frontend/src/bucket-list.tsx`, `frontend/src/items.ts`: the rating button and form for completed items, the rating and the detailed ratings and average on the card, and deleting the rating when completion is cancelled.
- There is no separate detail screen, so rating input is a dialog opened from the card.

## Tests

- `backend/test/items.test.ts`: an out-of-range score, a score that is not in steps of 0.5, criteria of another area, and a rating before completion are rejected with a Korean 400.
- `backend/test/db.integration.test.ts`: re-applying the migration, saving, keeping, and deleting ratings, and the DB `CHECK`.
- `frontend/src/bucket-list.test.tsx`: showing the criteria per area, saving and showing a rating, clearing, and the rejection message.

## Verification — 2026-10-31

Ran on Windows with a temporary PostgreSQL 17.11 set as `TEST_DATABASE_URL`.

- `npm run check`: pass. Backend 57 passed and 0 skipped, frontend 88 passed.
- `npm run knip`: pass.
- Migration: applied it to a DB with rows and confirmed that `rating` of the existing rows is empty. The first `CHECK` we wrote evaluated to false for rows with an empty rating and failed; this check found it and we fixed it.
- Browser: headless Chrome 156, mobile 390×844 (emulation without touch) and PC 1440×900. In the performance area we checked entering the overall and detailed ratings, showing the average, keeping them after a reload, and deleting them when completion is cancelled. The existing bucket list flow passed again. The console had only the 400 response records that we triggered on purpose.

## First review applied — 2026-10-31

A separate agent reviewed head `63de36f`. The 4 findings (0 blocking the merge, 1 to fix, 3 minor) were all test gaps and wording in docs, and there was no behavior defect. We applied all of them.

- We wrote the detailed criteria keys in a table in each of the server and screen tests, so that if a key changes on one side, that side test fails. The table is in two places, so fix them together.
- Added tests for accepting the score boundaries 0.5 and 5, and for changing the area of an item that has detailed ratings.
- Added a test that applies the migration to a table with rows, using a temporary schema. We reverted to a wrong `CHECK`, confirmed that this test fails, and reverted the code.
- Fixed the `CHECK` description to match the real range.

Something the review confirmed behaviorally but we did not fix: while a save request is running, the Select is not disabled, so a value changed then is not saved. The existing form is the same, and it only occurs in the short time the request is in progress.

### Verification

- `npm run check`: pass. Backend 63 passed and 0 skipped, frontend 88 passed.
- `npm run knip`: pass.

## Second review — 2026-10-31

A separate agent reviewed head `4afc6b4`. There was nothing to fix, and it confirmed that the 4 first-round findings were applied. The review ends after 2 rounds.
