# Quotes and highlights for books

- Issue: [#217](https://github.com/sirloinbh/life-journal/issues/217) (parent #206 Richer item records)
- Branch: `feat/217-book-quotes`

## Problem

The review of an item is limited to 500 characters and 5 lines (migration `004`), so quotes from a book either crowded out the review or were not kept at all.

## Change

- `database/migrations/011_item_quotes.sql`: table `item_quotes` (`item_id` → `items` with `ON DELETE CASCADE`, `text` 1-1,000 characters, optional `page` 1-99,999, optional `note` up to 500 characters and not blank, `created_at`, `updated_at`) with named CHECKs and an index on `(item_id, id)`. Safe to run again.
- `shared/contract.ts` (+ backend copy): `MAX_QUOTE_LENGTH = 1000`, `MAX_QUOTE_NOTE_LENGTH = 500`, `MAX_QUOTE_PAGE = 99999`.
- `backend/src/item-quotes.ts` (new), added to the items router:
  - `GET /api/items/:id/quotes` → `{ quotes }` in page order, quotes without a page last, each group in the order added. 404 for a missing item.
  - `POST /api/items/:id/quotes` → 201. Only reading items: `Only reading items can have quotes` (400). The item row is locked `FOR SHARE` while the quote is added, so a category change cannot slip in between.
  - `PATCH /api/items/:id/quotes/:quoteId` (partial) and `DELETE …/:quoteId` → 404 `Quote not found` when the quote is not under that item.
  - The text and note are trimmed with line ends stored as `\n`; a blank note is no note.
- `backend/src/items.ts`: an item PATCH that would move an item with quotes out of Reading is refused with `Delete the quotes of this item before moving it out of Reading`, so a quote never sits under a non-reading item. Other edits of a quoted book work as before.
- `backend/src/validation.ts` (new): `isStorable` and `strictObject` moved out of `items.ts` so `item-quotes.ts` can use them without an import cycle. No behavior change.
- `backend/src/openapi.ts`, `docs/openapi.json`: the four routes; the item DELETE summary says its quotes go with it.
- `frontend/src/item-quotes.tsx` (new): the quotes of a book in the item dialog: each quote as a block quote with "p. N · note", Edit (in place) and Delete (with confirmation), and an "Add a quote" form (quote with a 1,000-character counter, page, note with a 500-character counter). Loads with the shared query layer under the item list key.
- `frontend/src/bucket-list.tsx`: a "Quotes" button on reading items only, opening that dialog.
- `frontend/src/test/items-api.ts`: the fake API answers the quote routes.

Limits chosen here (the issue set only the 1,000-character text): page 1 to 99,999, note up to 500 characters (the same as a review).

### Not in this PR

- Export (#208) and restore (#209): not merged yet, and until #208 is merged other lanes do not touch the export code. When it is, `item_quotes` is a new table that must be added to both (follow-up).

## Verification

- Tests added or changed:
  - `backend/test/item-quotes.test.ts`: 400s for no body, missing, blank, non-text, too long, and NUL text; page 0, 1.5, `"3"`, and 100000; a too long and a non-text note; an unknown field; malformed item and quote ids; an empty patch. The text is trimmed with CRLF stored as `\n`, and a blank note is stored as null.
  - `backend/test/item-quotes.integration.test.ts`: the migration runs twice; add three quotes and list them in page order (no page last); edit page and note; a quote of another item is 404; delete; a movie refuses quotes (400) and a missing item is 404; a quoted book cannot move to Travel, other edits work, and after deleting its quote it can move; deleting the item removes its quotes; the CHECKs refuse a blank or too long text, page 0 and 100000, a blank or too long note; the foreign key refuses a missing item.
  - `frontend/src/bucket-list.test.tsx` "a book keeps quotes that are added, edited, deleted, and still there after a reload (#217)": two quotes are added (the POST bodies are checked), one is edited in place, the app is opened again and both come back from the server, one is deleted after confirming, and a travel item has no Quotes button.
- `npm test -w backend` (without the DB): pass. `npm test -w frontend -- src/bucket-list.test.tsx src/items.test.ts`: 78 passed.
- `npm run check` with the DB tests and the browser check: see below.

### `npm run check` with the DB tests (2026-11-26)

- Pass, with `TEST_DATABASE_URL` on `journal_test` (010 and 011 applied with `npm run db:migrate`): format, lint, contract 3, typecheck, backend 229 tests all passed (DB tests included, none skipped), frontend 48 files with 353 passed and 3 skipped, skills 4, build.
- Afterwards 011 was taken back out of the shared `journal_test` (table and `schema_migrations` row) so other lanes' branches are not affected before this merges; 010 (already on main) stays.

### Browser (2026-11-26)

Playwright Chromium on the Vite dev server (temporary port) with this branch's API on `journal_test` (temporary port, no sign-in):

- 390×844: Quotes on a reading item opens the dialog; two quotes added (one with page 120 and a note). Long quotes wrap inside the block quote, "p. 120 · The key line" shows under the first, and the dialog scrolls with no page overflow.
- Found here: after adding, the emptied quote field still showed the old counter ("88/1000"), because a form reset does not reach the Textarea counter. Fixed: the add form is mounted fresh after each added quote. The screen test now checks the counter reads `0/1000` after each add.
- 1440×900 after a page reload: the two quotes came back from the server; a third with page 3 was listed first (page order), and the counter read 0/1000.
- Console: only the dev-only Pretendard font 403s (this worktree's `node_modules` is outside the dev server's allowed folders).

### `npm run check` after the counter fix (2026-11-26)

- Pass. Format, lint, contract 3, typecheck, backend 192 passed and 37 DB tests skipped (run without `TEST_DATABASE_URL`; the backend is unchanged since the DB run above), frontend 353 passed and 3 skipped, skills 4, build. `npm run knip`: no unused export from this change.

## Review round 1 — 2026-11-26

Self-review of head `f727c8f` (std-code-review section 8). Decision: changes needed, 3 findings (non-blocking), all fixed.

| Finding                                                                                                             | Handling                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `suggestion:` Edit swaps the quote for its form, so the focused Edit button vanished and the focus fell to the page | The edit form focuses its Quote field when it opens (keyed by the quote id, so a background refresh does not pull the focus back) |
| `suggestion:` Save quote or Cancel closes the edit form and its buttons vanished                                    | The focus goes back to that quote's Edit button                                                                                   |
| `suggestion:` after a confirmed delete the focus returned to the vanished Delete button                             | `returnFocusRef` sends it to the add form's Quote field                                                                           |

Checked and fine: the PATCH builds its `SET` only from the fixed keys `text`, `page`, `note`; a quote is reached only through its own item (`AND item_id = $2`); adding locks the item `FOR SHARE`, and the item PATCH holds `FOR UPDATE`, so a category change and a new quote cannot pass each other; `ON DELETE CASCADE` removes quotes with the item (tested).

### Verification

- The #217 screen test also checks the focus in the edit form, back on the Edit button after saving, and on the add form after a delete. `npm test -w frontend -- src/bucket-list.test.tsx -t quotes`: passed.
- `npm run check`: see below.

### `npm run check` after round 1 (2026-11-26)

- Pass. Format, lint, contract 3, typecheck, backend 192 passed and 37 DB tests skipped (frontend-only change, no `TEST_DATABASE_URL`), frontend 353 passed and 3 skipped, skills 4, build.
