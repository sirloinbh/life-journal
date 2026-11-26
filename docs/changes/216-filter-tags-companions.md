# Filter the items table by tag and companion

- Issue: [#216](https://github.com/sirloinbh/life-journal/issues/216) (parent #206 Richer item records; follows #215)
- Branch: `feat/216-filter-tags-companions`

## Problem

Tags and companions (#215) only help find records if the table can filter on them.

## Change

- `backend/src/items.ts`: `GET /api/items` takes `tag` and `companion`. Each is one name (NFC-normalized, trimmed, up to 50 characters; a blank value is no filter) and matches an item whose list holds that whole name in any letter case: `EXISTS (SELECT 1 FROM unnest(tags) AS name WHERE lower(name) = lower($n))`, the same comparison that keeps the lists unique (migration 010). They combine with every other filter, the sort, and paging (the total counts only matching items). Errors: `Tag filter must be a single value`, `… must be 50 characters or fewer`, `… contains a character that is not allowed` (and the same for Companion).
  - The AI tool `list_items` keeps its own filter set (`q`, `category`, `status`, `from`, `to`), so it gets no companion filter.
- `frontend/src/items-table.tsx`: "Tag" and "Companion" text filters next to the others. Like the other text filters they apply on Enter or leaving the field, live in the address (`?tag=…&companion=…`), come back from it on reload or going back, and are emptied by "Clear filters". The hint under the filters says they match a whole name in any letter case.
- `docs/openapi.json`: regenerated (the two query parameters).

Whole-name matching (not "contains") was chosen because a tag is a label: "family" should not find "with family". The issue did not set this.

## Verification

- Tests added:
  - `backend/test/items.test.ts`: 400s for a repeated `tag`, a 51-character tag, a NUL in `companion`, and a 51-character companion.
  - `backend/test/db.integration.test.ts` "the list filters by a whole tag or companion in any letter case, with other filters and paging (#216)": case-insensitive whole-name matches (`fam` and `family` do not match `with family`), companion alone and with a tag, with category and cost filters, a blank tag is no filter, and pages of 2 report total 3 and the right next offsets.
  - `frontend/src/items-table.test.tsx`: "a tag filter shows only the matching rows and stays in the address with the others (#216)" (Enter applies a trimmed tag, only matching rows remain, the category filter combines in the address, a companion with no match shows the empty notice, Clear filters empties both fields) and "tag and companion filters in the address are used and shown (#216)".
- `npm test -w backend` (without the DB): 181 passed, 34 skipped. `npm test -w frontend -- src/items-table.test.tsx`: 30 passed.
- `npm run check` with the DB tests and the browser check: see below.

### `npm run check` with the DB tests (2026-11-26)

- Pass, with `TEST_DATABASE_URL` on `journal_test`: format, lint, contract 3, typecheck, backend 223 tests all passed (DB tests included, none skipped), frontend 49 files with 359 passed and 3 skipped, skills 4, build.
- The blank-tag check in the DB test only looks for the five sample titles: other test files can add rows to the shared table while it runs (seen as a race on PR #224).

### Browser (2026-11-26)

Playwright Chromium on the Vite dev server (temporary port) with this branch's API on `journal_test` (temporary port, no sign-in):

- 390×844: typing "WITH FAMILY" in Tag and pressing Enter set `?tag=WITH+FAMILY` and left only the items tagged "With family" or "with family" (the one tagged "birthday" was gone); the two new fields stack under the others, no page overflow.
- 1440×900: adding Companion "dad" (stored as "Dad") set `?tag=WITH+FAMILY&companion=dad` and left one item, "1 item". The two fields sit in the same grid as the other filters.
- Console: only the dev-only Pretendard font 403s.

## Review

- Round 1 (PR comment): approve, no blocking comments. One `note:` left as is: the table filters take typed names without suggestions, and the table does not show tags.
- Merged `origin/main` (#217, quotes) into the branch: no conflicts. `npm run check` again with the DB tests on `journal_test` (migrated to 011): pass, backend 242 tests, frontend 49 files with 360 passed and 3 skipped, contract 3, skills 4, build.
