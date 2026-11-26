# #208 Export all records as a JSON and CSV download

- Issue: [#208](https://github.com/sirloinbh/life-journal/issues/208)
- Branch: `feat/208-export-records`

## Purpose

All data lives in one Docker volume that `docker compose down -v` deletes, and there was no way to take a copy out of the app. Settings now downloads every record as one JSON file (the input of restore, #209) and the items as a CSV file for a spreadsheet.

## Decision

What the export contains (asked the coordinator, which stopped without answering and said to decide; the issue's recommendation was taken and recorded in [a comment on #208](https://github.com/sirloinbh/life-journal/issues/208#issuecomment-7178359379)): `items` and `learned_terms`, and every new data table as it is added. `audit_log` is left out as an operations log; `app_settings` too, because nothing stores a setting yet. Photos (#29) wait for that issue.

## Changes

- `backend/src/export.ts` (new): `GET /api/export` answers `{ format: 'life-journal-export', version: 1, exportedAt, tables: { items, learned_terms } }` as `life-journal-YYYY-MM-DD.json`; `GET /api/export/items.csv` answers the items as `life-journal-items-YYYY-MM-DD.csv`. Both read in one `REPEATABLE READ READ ONLY` transaction and send `Cache-Control: no-store`. `EXPORT_TABLES` lists each table's columns and query: timestamps as UTC text with microseconds (a JS `Date` would drop them and restore could not write back the same value), `rating` as a number. `exportedAt` is Asia/Seoul with `+09:00`. The CSV has a UTF-8 BOM, CRLF line ends, every value quoted, `null` as an empty unquoted field, and `details` / `sub_ratings` as JSON text.
- `backend/src/app.ts`: mounts the router at `/api/export`, after the shared sign-in like every other route.
- `backend/src/openapi.ts`, `docs/openapi.json` (regenerated), `backend/test/openapi.test.ts` (`/api/export` added to the known mounts): the two routes are documented.
- `frontend/src/backup.tsx` (new): Settings › "Back up records" with "Download all records (JSON)" and "Download items (CSV)". A download on its way ignores more clicks (the buttons stay focusable with `aria-disabled`); the result or the server's error shows in the card's Notice. `frontend/src/backup-download.ts` (new) fetches the file, takes its name from `Content-Disposition`, and saves it through an object URL. `frontend/src/app.tsx`: the Settings page shows it instead of the "No features yet" placeholder.
- `docs/export-format.md` (new): the JSON format, value rules, the tables in version 1, what is left out, how a lane adds a table, and the CSV rules.
- Tests: `backend/test/export.test.ts` (CSV quoting round trip, Seoul time, both routes with a fake pool: headers, body, one snapshot), `backend/test/export.integration.test.ts` (DB), `backend/test/csv.ts` (an RFC 4180 reader for the tests), `frontend/src/backup.test.tsx` (both downloads, BOM bytes kept, server error, unreachable server, repeated clicks, file name parsing).

## Verification

- `tsx --test test/export.test.ts test/openapi.test.ts` (backend): 9 pass, 0 fail.
- `npm run test -w frontend -- src/backup src/app.test`: 17 passed.
- Browser: Vite on a temporary port with `/api/export` and `/api/export/items.csv` stubbed by Playwright, Chrome at 390×844 and 1440×900: both buttons by keyboard (Enter) start a download named `life-journal-2026-11-26.json` / `life-journal-items-2026-11-26.csv`, the saved CSV starts with the bytes `EF BB BF` and keeps Korean text, the status line names the file, the focus stays on the button, no horizontal overflow. The only console errors were 403s for font files outside this worktree (as in #218), unrelated.
- `npm run check` with `TEST_DATABASE_URL` (2026-11-26, after merging `origin/main`): pass. Backend 206 pass, 0 fail, 0 skipped (DB tests ran), frontend 357 passed, 3 skipped, skills 4 pass, build passes. `npm run knip`: no unused export. The DB was a scratch database (`journal_lane1_scratch`, made with `src/migrate.ts` from this branch's migrations 001-009, dropped afterwards) because the shared `journal_test` holds other lanes' unmerged migrations (`010_item_tags_companions.sql` adds `items.tags` and `items.companions`), which fail this branch's column check and the CHECK-name test.
- The first full run hung: the new integration test registered `t.after(pool.end)` before `t.after(client.release)`, so `pool.end()` waited for the checked-out client forever. The client is now released in the test's `finally` after `ROLLBACK`; the file alone finishes in about 1 s.

## Limits

- The real API was not started for the browser check; the backend tests cover the real answers.
- The integration test fails while the database has an `items` column that the export does not list. That is on purpose: a lane that adds a column (such as `tags` and `companions`, which another lane is adding) has to add it to `EXPORT_TABLES` in the same PR.
- The CSV does not guard against spreadsheet formulas (a value starting with `=`): it holds only my own records, and changing values would break the round trip (`docs/export-format.md`).

## Review round 1

- No blocking findings. Notes left as is: a 401 from a download shows the message but does not go through the sign-in gate (`fetch`, not `requestJson`); the export is built in memory, which is fine at this size.
