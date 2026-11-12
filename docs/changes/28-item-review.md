# #28 Leave a short review on a completed item

- Issue: [#28](https://github.com/sirloinbh/life-journal/issues/28)
- Branch: `feat/28-item-review`

## Purpose

Leave a short review on a completed item. So that it does not get long, the number of lines and characters is limited on both the server and the screen.

## Decision

The user decided in an issue comment on 5 lines at most and 500 characters in total. This is more generous than the first requirement "1 to 3 lines" and the recommendation "3 lines, 300 characters".

The values decided during implementation are as follows.

- Leading and trailing whitespace is removed only at the start and end of the whole text. Whitespace inside a line and at the end of a line is left as is.
- Whitespace only counts as clearing the review.
- The number of characters is counted as the JavaScript string length. An emoji can count as 2.
- Line breaks LF, CR, CRLF, and U+0085, U+2028, and U+2029 all count as one line.
- The issue's "limit on characters per line" was not added, because the user decision set only the number of lines and the total number of characters.
- The card preview uses the first line that has visible content.
- A review can be set only on a completed item. If completion is cancelled, it is cleared too, and the confirmation dialog says so.

## Changes — 2026-10-31

- `database/migrations/004_item_review.sql`: `review` column. The DB blocks the 500 characters and the "completed items only" rule with `CHECK`. The API checks the number of lines.
- `backend/src/items.ts`: review validation, line break cleanup, save, and update.
- `frontend/src/bucket-list.tsx`, `frontend/src/items.ts`: the review button and form for completed items, the line and character count display, screen validation, and the first-line preview on the card.
- There is no shared `textarea` component, so we put it in the form with the same style as `Input`.

## Tests

- `backend/test/items.test.ts`: 6 lines, 6 lines with Windows line breaks, 501 characters, a non-string value, a NUL character, and a review before completion are rejected with a Korean 400. 5 lines and 500 characters and the whitespace cleanup are accepted.
- `backend/test/db.integration.test.ts`: re-applying the migration and applying it to a table with rows, save, keep, update, delete, and the DB `CHECK`.
- `frontend/src/bucket-list.test.tsx`: writing, the first-line preview, editing, clearing, the limits blocked on the screen, and showing a server error.

## Verification — 2026-10-31

Ran on Windows with a temporary PostgreSQL 17.11 set as `TEST_DATABASE_URL`.

- `npm run check`: pass. Backend 73 passed and 0 skipped, frontend 92 passed.
- `npm run knip`: pass.
- Browser: headless Chrome 156, mobile 390×844 (emulation without touch) and PC 1440×900. We checked the Korean error for a 6-line input, the first-line preview, keeping it after a reload, the full content in the form, and deleting it when completion is cancelled. The existing bucket list and rating flows passed again. The console had only the 400 response records that we triggered on purpose.

## First review applied — 2026-10-31

A separate agent reviewed head `7b33ae6`. We applied all 5 findings (0 blocking the merge, 1 to fix, 4 minor).

- Added tests that check on a real DB editing a review to other content, and cancelling completion of an item that has a review.
- Other line separator characters such as U+2028 are also counted as lines on the server and the screen.
- Fixed the preview becoming an empty line when the first line had only zero-width characters. A review with only zero-width characters is saved, but the preview is not shown.
- Editing the content clears the earlier error message.
- Added tests for 250 and 251 emoji, an unpaired surrogate, CR line breaks, and the DB `CHECK` on the cancel-completion UPDATE.

### Verification

- `npm run check`: pass. Backend 78 passed and 0 skipped, frontend 95 passed.
- `npm run knip`: pass.
- We ran the whole flow again in headless Chrome 156, at mobile 390×844 and PC 1440×900, and it passed.

## Second review applied — 2026-10-31

A separate agent reviewed head `3082054`. We applied the 1 finding (minor) and confirmed that the 5 first-round findings were applied. As the rule says, there is no third review.

- The preview also skips a line that has only blank characters such as U+3164 and format characters. We treat Unicode format characters (`Cf`) and U+115F, U+1160, U+2800, U+3164, and U+FFA0 as invisible characters.

### Verification

- `npm run check`: pass. Backend 78 passed and 0 skipped, frontend 102 passed.
- `npm run knip`: pass.
- This commit changed only the regular expression and the screen tests, so we did not redo the browser check. The reviewer reproduced the same input in the browser on the previous commit, and the fixed behavior was checked with the screen tests.
