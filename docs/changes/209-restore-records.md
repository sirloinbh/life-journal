# #209 Restore records from a JSON export

- Issue: [#209](https://github.com/sirloinbh/life-journal/issues/209)
- Branch: `feat/209-restore-records` (stacked on `feat/208-export-records`, PR #226)

## Purpose

A download alone is half a backup: after `docker compose down -v` or a move to a new machine there was no way to put the records back. Settings › Restore records now takes the JSON export from #208 and puts every record back.

## Decision

Restore policy (asked the coordinator, which said to build on the issue's recommendation while the owner's answer is pending; recorded in [a comment on #209](https://github.com/sirloinbh/life-journal/issues/209#issuecomment-7178360322)): replace all data, never merge, in one transaction, after a confirmation that shows the counts in the file; the screen suggests downloading a fresh export first.

## Changes

- `backend/src/restore.ts` (new): `POST /api/restore`. `exportFile` (Zod) checks the whole file first: `format`, `version` 1, both tables, every row's fields and types (strict: unknown fields and tables are refused, not dropped), and duplicate keys. A refused file answers 400 with the first problems by path (`tables.items.2.title: Title must not be empty`) and `fields`. `replaceRecords` then locks `items` and `learned_terms`, deletes every row, inserts the file's rows with their own ids (`OVERRIDING SYSTEM VALUE`, one `jsonb_to_recordset` statement per table), and moves the id sequence past the largest id, all in one transaction. A row the database refuses (SQLSTATE class 22 or 23) rolls back and answers 400 with the constraint name.
- `backend/src/app.ts`: the global JSON parser (256 kB) skips `/api/restore`, whose route reads its own body up to 20 MB after the sign-in check; the router is mounted at `/api/restore`. Every other route keeps the 256 kB limit.
- `backend/src/export.ts`: `EXPORT_FORMAT` and `EXPORT_VERSION` are exported again for restore.
- `backend/src/openapi.ts`, `docs/openapi.json` (regenerated), `backend/test/openapi.test.ts` (known mount): the route is documented with the `ExportFile` body schema.
- `frontend/src/restore.tsx` (new), `frontend/src/restore-file.ts` (new), `frontend/src/backup.tsx`: Settings shows "Restore records" under "Back up records". Choosing a file reads it in the browser (not JSON, another file, another version, or over 20 MB is reported at once) and shows its name, export time, and counts. "Restore from this file" opens a confirmation ("Replace all records?" with the counts); after a restore the card says what was restored, the file is cleared, and every cached list reloads. A server error shows in the card after the dialog closes.
- `docs/export-format.md`: a Restore section, and how a new column or table joins restore.
- Tests: `backend/test/restore.test.ts` (14: a valid file runs the statements in one transaction, 9 kinds of refused file never touch the database, a CHECK failure rolls back with the rule's name, a body over 256 kB is read while `POST /api/items` still answers 413, over 20 MB is 413, the sign-in guards the route), `backend/test/restore.integration.test.ts` (DB: export a seeded database, empty it, restore, and get identical rows; a file with one row the database refuses leaves everything as it was; a new item after the restore gets the next id), `frontend/src/restore.test.tsx` (9).

## Verification

- `tsx --test test/restore.test.ts` (backend): 14 pass, 0 fail.
- `npm run test -w frontend -- src/restore src/backup src/app.test`: 25 passed.
- DB tests on a scratch database made from this branch's migrations (the shared `journal_test` holds another lane's unmerged migration, see #208), under the check lock: `restore.integration.test.ts` and `export.integration.test.ts` 2 pass, 0 fail.
- `npm run check` with `TEST_DATABASE_URL` on that scratch database: pass. Backend 221 pass, 0 fail, 0 skipped; frontend 365 passed, 3 skipped; skills 4 pass; build passes. `npm run knip` then listed `RESTORE_BODY_LIMIT` as an unused export; it is no longer exported (`npm run knip` clean for the new files, eslint passes).
- Browser: Vite on a temporary port with `/api/restore` stubbed by Playwright, Chrome at 390×844 and 1440×900: choose a file, open the confirmation and confirm by keyboard; the dialog shows the counts, the posted body equals the file, the card says "Restored 2 items and 1 learned term from …", the focus returns to the file input, no horizontal overflow.

## Limits

- The real API was not started for the browser check; the DB test covers the real restore.
- The confirmation is the only guard against restoring by mistake; there is no automatic backup before a restore (the screen suggests downloading one).
- The restore runs under the pool's 15 s statement timeout. A file near 20 MB was not timed; one person's records are far smaller.

## Merge with #208 and main: tags and companions

- #208 now exports `items.tags` and `items.companions` (added to main by #215 while this was open), so restore reads them too: both are required string arrays in the row schema (the database checks the names), and both are in the `INSERT` column lists (`text[]` from the JSON arrays). The unit tests refuse `tags` that are not a list, and the DB round trip seeds a row with a tag holding a comma and quotes and a Korean companion name.
- `backend/test/openapi.test.ts`: the known mounts keep `/api/export`, `/api/stats`, and `/api/restore`; `docs/openapi.json` regenerated.
- The first full check after the merge failed once in `export.integration.test.ts` (5 exported items, `count(*)` 2): under READ COMMITTED another test file's `DELETE FROM items` committed between the two statements. Both DB tests now lock `items` and `learned_terms` in EXCLUSIVE mode right after `BEGIN` (reads still pass), so other files' writes wait until the rollback.
- After the merge and the lock: `npm run check` with `TEST_DATABASE_URL` on a scratch database from migrations 001-010: pass (backend 239 pass, 0 fail, 0 skipped; frontend 374 passed, 3 skipped; skills 4 pass; build passes). `npm run knip`: no unused export.

## Merge with #208 and main: quotes and logs

- #208 now exports `item_quotes` (#217) and `item_logs` (#214), which main added while this was open, so restore reads them too (coordinator request). `backend/src/restore.ts`: row schemas for both (strict, ids, dates, UTC times; the database checks lengths, the page range, and rating steps); both tables are optional and default to empty, so a version-1 file made before them still restores; duplicate ids are refused; a quote or log must belong to an item in the file of a category that takes it (quotes on `reading`, logs on `LOG_CATEGORIES`), the API's own rule, with the path in the message. `replaceRecords` locks the four tables (`items` first, the order a cascading `DELETE FROM items` takes, so they cannot deadlock), deletes children first, inserts parents first, moves all three id sequences, and answers the four counts.
- `frontend/src/restore-file.ts`, `frontend/src/restore.tsx`: the summary, the confirmation, and the result name quotes and tastings or visits when the file has some (`describeCounts`), such as "5 items, 1 quote, 2 tastings or visits, and 4 learned terms".
- `docs/export-format.md` (Restore section), `backend/src/openapi.ts` (the answer's counts), `docs/openapi.json` (regenerated; its conflict with #208 was resolved by regenerating).
- Tests: `backend/test/restore.test.ts` (22: the statement order with the new tables, an older file without them restores with 0 of each, six new refused files: an empty quote, a duplicate quote id, a quote on a drink, a log of an item not in the file, a log on a reading item, a log without its date), `backend/test/restore.integration.test.ts` (seeds a quote and a wine log, round trips them, and checks that each of the three sequences continues; the test puts all three back), `frontend/src/restore.test.tsx` (counts of quotes and logs, the count sentence).
- `npm run check` with `TEST_DATABASE_URL` on a scratch database from migrations 001-013 (dropped afterwards), under the check lock: pass. Backend 293 pass, 0 fail, 0 skipped; frontend 380 passed, 3 skipped; skills 4 pass; build passes. `npm run knip`: no unused export (only its usual config hints).
- Browser: Vite on a temporary port with `/api/restore` stubbed by Playwright, Chrome at 390×844 and 1440×900: a file with 3 items, 1 quote, 2 logs, and 1 learned term; the confirmation and the result say "3 items, 1 quote, 2 tastings or visits, and 1 learned term", confirmed by keyboard, the posted body holds all four tables, the focus returns to the file input, no horizontal overflow. The only console errors were the known 403s for font files outside this worktree.
