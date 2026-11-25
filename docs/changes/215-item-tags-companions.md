# Free tags and companions on items

- Issue: [#215](https://github.com/sirloinbh/life-journal/issues/215) (parent #206 Richer item records)
- Branch: `feat/215-item-tags-companions`

## Problem

An item had no way to record the occasion ("birthday", "with family") or who I was with, so I could not find those records later.

## Change

- `database/migrations/010_item_tags_companions.sql`: `items.tags` and `items.companions`, both `text[] NOT NULL DEFAULT '{}'`. The CHECKs `items_tags_check` and `items_companions_check` call `item_names_valid`: a one-dimensional list of at most 20 names, each 1 to 50 characters with no surrounding spaces, no NULL, and no name twice when letter case is ignored. Safe to run again (the function is replaced, each CHECK is dropped by name and added again).
  - Columns, not separate tables: the names belong to the item row, so create and edit stay one statement, PATCH merges them like every other field, and the list filter of #216 can test the row directly.
- `shared/contract.ts` (+ backend copy): `MAX_ITEM_NAMES = 20`, `MAX_ITEM_NAME_LENGTH = 50`.
- `backend/src/items.ts`: `tags` and `companions` in POST and PATCH. Each name is NFC-normalized and trimmed; an empty name is refused (`Tag cannot be empty`, `Companion cannot be empty`); a name that repeats an earlier one when letter case is ignored is merged, keeping the first spelling; the 20-name limit applies after the merge. Both are in every item answer.
  - Companion names are personal data (issue note): the AI tool `list_items` selects every column except `companions`, so they never reach shared-ai.
- `frontend/src/item-names-field.tsx` (new): the tag and companion input on the item form. Enter, a comma, or the Add button adds the typed name; each name shows as a chip with a remove button; names used on any item are suggested through the shared Combobox (already added names are left out). Text still in the field when the form is saved goes with it. Enter in an empty field still saves the form.
- `frontend/src/items.ts`: `Item.tags`, `Item.companions`; `addName` (the same trim and merge rules as the server); `usedNames` (suggestions from every loaded item, most used first, then alphabetical); `itemFields` sends both lists.
- `frontend/src/bucket-list.tsx`: the two fields on the add and edit form; the item card shows tags as badges and companions as "With …".
- `docs/openapi.json`: regenerated.

Limits chosen here (the issue set none): 20 names per list and 50 characters per name.

### Not in this PR

- Export (#208) and restore (#209): not merged yet, and until #208 is merged other lanes do not touch the export code. Because the names are columns of `items`, they need no new table in the export; the item export must only keep these two fields. If #208 merges without them, a follow-up adds them.
- Filtering the table by tag and companion: #216.

## Verification

- Tests added or changed:
  - `backend/test/items.test.ts`: 400s for a blank tag, an empty companion, tags that are not a list, a companion that is not text, a tag over 50 characters, a NUL in a companion, 21 different tags; "tags and companions are trimmed and merged without regard to letter case" (21 names with one case-only duplicate pass as 20; NFD Hangul merges with NFC; an item without them stores empty lists).
  - `backend/test/db.integration.test.ts`: "tags and companions are trimmed, merged, kept, and replaced" (POST, PATCH of another field keeps them, a blank tag is a 400 and changes nothing, PATCH replaces them; the DB CHECKs refuse padded, empty, case-duplicate, NULL, too long, 21 names, and two-dimensional lists in both columns). The read-back test expects the two empty lists; 010 joins the run-twice migration test.
  - `backend/test/items-check-names.integration.test.ts`: the two new CHECK names.
  - `backend/test/ai-tools.integration.test.ts`: `list_items` returns tags but no `companions` field.
  - `frontend/src/items.test.ts`: `addName`, `itemFields`, `usedNames`.
  - `frontend/src/bucket-list.test.tsx` "tags and companions are added, suggested, saved, shown, and removed (#215)": a suggestion from another category is picked, Enter, comma and the Add button add names, a case-only duplicate is not added, text left in the companion field is saved, the card shows the tags and "With 아빠", and removing both in the edit form saves `tags: ['birthday'], companions: []`.
- `npm test -w backend`: 169 passed, 32 DB tests skipped (no `TEST_DATABASE_URL` in that run).
- `npm run test -w frontend -- src/items.test.ts src/bucket-list.test.tsx`: 81 passed.
- `npm run check` with the DB tests: see below.

### `npm run check` (2026-11-26)

- Pass, with `TEST_DATABASE_URL` on the local `journal_test` (010 applied with `npm run db:migrate`): format, lint, contract 3 passed, typecheck, backend 201 tests all passed (the 32 DB tests included, none skipped), frontend 46 files with 324 passed and 3 skipped, skills 4 passed, build.
- After the run, 010 was taken back out of the shared `journal_test` (columns, CHECKs, function, and its `schema_migrations` row), so other lanes' branches without it keep passing until this merges.

### Browser (2026-11-26)

Playwright Chromium on the Vite dev server (temporary port) with this branch's API on `journal_test` (temporary port, no sign-in):

- 390×844: on Travel, Add item, typed "with family" + Enter and a 49-character tag + Enter, and "엄마" + Enter in Companions. The chips wrap and the long tag is cut with an ellipsis inside the dialog. After Save the card shows both tags as badges (the long one wraps) and "With 엄마"; no horizontal page overflow.
- 1440×900: Edit on another item, typing "fa" in Tags suggests "with family" from the other item under the field.
- Console: only 403s for the Pretendard font files, which the dev server refuses because this worktree's `node_modules` lives outside its allowed folders (dev setup only, not app code).
