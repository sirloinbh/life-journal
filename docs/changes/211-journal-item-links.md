# #211 Link the day's completed items to a journal entry

- Issue: [#211](https://github.com/sirloinbh/life-journal/issues/211)
- Branch: `feat/211-journal-item-links` (built on `feat/210-daily-journal`, PR #228, which is not merged yet)
- Link rule: the owner chose **option A** on 2026-11-26 ([comment](https://github.com/sirloinbh/life-journal/issues/211#issuecomment-7188786754)): only items completed on the entry's date can be linked, as implemented.

## Purpose

A journal entry often talks about a play, a book, or a trip that is already an item on the bucket list. This links the entry to those items, so the day's page shows what was done that day and each item opens from the journal.

## Changes

- `database/migrations/014_journal_entry_items.sql` (new): `journal_entry_items` with the entry, the item, and the time of the link, one row per pair (`journal_entry_items_pkey`), and an index on the item. Deleting the entry or the item removes the link (`ON DELETE CASCADE`). A trigger on `items` removes a link when the item's completed date changes to another day or is cleared (the item is marked as not done), so a link always matches the rule without touching `items.ts`. Safe to run again.
- `backend/src/journal-items.ts` (new), added to the journal router:
  - `GET /api/journal/:date/items`: `{ linked, suggestions }`. `linked` holds the items linked to the date's entry, oldest link first. `suggestions` holds the items completed that date that are not linked yet; they are listed even when the day has no entry.
  - `PUT /api/journal/:date/items/:itemId`: links the item. 201 when new, 200 when it was already linked. 404 "Journal entry not found" or "Item not found". 400 "Only items completed on the day of the entry can be linked" for an item of another day or a wishlist item. The entry and the item are locked in one transaction, so the item's date cannot change between the check and the link.
  - `DELETE /api/journal/:date/items/:itemId`: 204, or 404 "Link not found".
  - A bad date or item ID answers 400 before any query.
- `backend/src/journal.ts`: calls the new routes (the date schema is passed in, so the two modules do not import each other).
- `backend/src/openapi.ts`, `docs/openapi.json` (14 paths): the three routes are documented, and the entry delete says it removes the links.
- `frontend/src/journal.tsx`, `frontend/src/app.tsx`: a "Done that day" section under the editor.
  - Linked items show their title (a link to the item on the bucket list), category, and rating, with an "Unlink" button.
  - "Completed on this day and not linked yet" lists the suggestions with a "Link" button. Without a saved entry the buttons are off and the text says to save the entry first.
  - A day with nothing completed says "No bucket-list items were completed on this day."
  - After Link or Unlink, a status line confirms it ("Linked Hamlet"), and the focus moves to the button that took the pressed one's place.
  - Deleting the entry reloads the section, since its links are gone.

## Tests

- `backend/test/journal.test.ts`: a bad date on the item list and on a link, and a bad item ID to link or unlink, are refused with 400 before any query.
- `backend/test/journal-items.integration.test.ts` (new, needs `TEST_DATABASE_URL`, own schema `test_journal_items`, migration 014 applied twice):
  - the day's items are suggested without an entry, and linking then answers 404;
  - after the entry is saved, a link is 201, a second one 200, and the item moves from the suggestions to the linked list;
  - another day's item and a wishlist item are refused with 400, and a missing item with 404;
  - unlink is 204, then 404.
  - In the database, moving an item's completed date, marking it not done, and deleting it remove its link, renaming it keeps the link, a second row for a pair is refused, and deleting the entry removes the rest.
- `frontend/src/journal.test.tsx`:
  - The day's item is suggested with its bucket-list link and rating, and it cannot be linked before the entry is saved.
  - After a save, Link moves it to the linked list with the focus on Unlink, and Unlink brings it back with the focus on Link.
  - A day with nothing completed says so.

## Limits and follow-up

- If the owner picks option B (any completed item, same-day items suggested first) or C (any item, including the wishlist), the check in `PUT`, the suggestions, and the trigger change. The PR waits for that answer.
- Export and restore (#208, #209) are not on `main` yet. When they are, the link table has to be added with the journal table.

## Verification

- `npm run typecheck -w backend`, `npm run typecheck -w frontend`, and eslint on the changed files: pass.
- `vitest run src/journal.test.tsx`: 9 passed.
- With the shared lock and `TEST_DATABASE_URL` on a fresh lane DB (migrations 001-013 applied by `npm run db:migrate`): `npm run test -w backend` 264 passed, 0 failed, 0 skipped.
- Browser: Vite on 127.0.0.1:5214 with `/api/*` stubbed by Playwright (an entry for 2026-11-26 and three items completed that day, one with a long title), Chrome.
  - 390×844 and 1440×900: no horizontal page overflow; on the phone the button wraps under a long title.
  - Keyboard: Enter on "Link Hamlet ..." links it, "Linked Hamlet ..." appears, and the focus lands on its "Unlink" button.
  - Console: only the 403s for the Pretendard font files (this worktree's `node_modules` is outside the Vite allow list), not related.
- `npm run check` and `npm run knip` with `TEST_DATABASE_URL` on a fresh lane DB (migrations 001-013): pass. Backend 264 passed, 0 skipped; frontend 369 passed, 3 skipped (existing); contract 3; skills 4; build passed; knip shows only its two existing configuration hints.

## Review round 1

- nit: the focus hand-off after Link or Unlink cleared its target even when the button was still disabled for a moment, which would drop the focus to the page. It now waits until the button is enabled (it also re-runs when the write ends).
- nit: the item delete route's summary now says it also removes the item's journal links (`docs/openapi.json` regenerated).
- Checked, no change:
  - `PATCH /api/items/:id` always sets `completed_date`, so the trigger runs on every date change. It removes the link only when the date really changes.
  - A link and a date change at the same time cannot leave a wrong link: the link locks the item row, so the change waits and its trigger runs after the link exists. A change that came first is seen by the lock.
  - A bad date or ID is refused before any query.
  - Deleting the entry reloads the section.
- `vitest run src/journal.test.tsx`: 9 passed. `npm run check` and `npm run knip` with `TEST_DATABASE_URL` after the fix: pass (backend 264/0 skipped, frontend 369 passed + 3 skipped).

## Owner decision and merge with #228

- The owner chose option A on 2026-11-26: the link rule stays as built. The comments in `backend/src/journal-items.ts` and the migration now say so.
- `database/migrations/013_journal_entry_items.sql` is renamed to `014_journal_entry_items.sql`: `main` already has `013_item_logs.sql` (#214). The integration test applies `014` twice.
- `origin/feat/210-daily-journal` (#228 with the optional title, owner decision B, and `origin/main`) is merged in. Conflicts: the header comments of `backend/src/journal.ts` and `frontend/src/journal.tsx` (both decisions kept), the `DELETE /api/items/:id` summary in `backend/src/openapi.ts` ("with its quotes, logs, and journal links"), and the `Entry` type in `frontend/src/journal.test.tsx` (with `title`). `docs/openapi.json` regenerated.
- `npm run check` (2026-11-26, without `TEST_DATABASE_URL`: the local DB credentials were not available to the agent): pass. Backend 293 tests, 246 pass, 0 fail, 47 skipped (the DB tests); frontend 377 passed, 3 skipped; skills 4 pass; build passes. The DB tests run in CI against its own Postgres.
- After #228 merged: the base is `main`, and `origin/main` is merged in without conflicts. `npm run check` (no `TEST_DATABASE_URL`): pass. Backend 324 tests, 275 pass, 0 fail, 49 skipped (the DB tests); frontend 395 passed, 3 skipped; skills 4 pass; build passes. Export and restore do not hold the journal tables yet; #233 adds them (a restore now cascade-deletes the links with the items).
