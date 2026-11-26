# #210 Write one journal entry per day

- Issue: [#210](https://github.com/sirloinbh/life-journal/issues/210)
- Branch: `feat/210-daily-journal`
- Entry rules: the owner chose **option B** on 2026-11-26 ([comment](https://github.com/sirloinbh/life-journal/issues/210#issuecomment-7188786200)): an optional title up to 200 characters, plain text with line breaks up to 10,000 characters, no dates after today (Asia/Seoul). The first version of this PR was built on option A (no title); the title was added after the decision (see "Owner decision: optional title" below).

## Purpose

The service is described as a place for reviews and diary entries, but only bucket-list items existed. This adds the diary: one entry per date, written and read in the app.

## Changes

- `database/migrations/012_journal_entries.sql` (new; 010 is on main and 011 is reserved by the open #217 branch): `journal_entries` with an id, a unique `entry_date`, the `body` text (CHECK 1 to 10,000 characters), and timestamps. Constraint names are explicit (`journal_entries_entry_date_key`, `journal_entries_body_check`). Safe to run again (`CREATE TABLE IF NOT EXISTS`).
- `backend/src/journal.ts` (new):
  - `GET /api/journal?limit&offset`: entries newest date first (limit 1-100, default 20), with `nextOffset` and `total`.
  - `GET /api/journal/:date`: the entry, or 404 "Journal entry not found".
  - `PUT /api/journal/:date` with `{ body }`: writes the entry of the date. Saving again on the same date replaces the text of the one entry (one upsert on the unique date): 201 when new, 200 when replaced. Line breaks of every kind become `\n`, the text is trimmed, and it must have 1 to 10,000 characters (counted as the screen's counter counts) with no NUL or lone surrogate. Unknown fields (a title) and dates after today are refused.
  - `DELETE /api/journal/:date`: 204, or 404 when there is no entry.
  - A date that is not a real `YYYY-MM-DD` answers 400 before any query.
- `backend/src/app.ts`, `backend/src/openapi.ts`, `docs/openapi.json`: the routes are mounted at `/api/journal` and documented.
- `frontend/src/journal.tsx` (new), `frontend/src/app.tsx`: a "Journal" menu entry and the page `/journal/:date`. A missing, unreal, or future date goes to today.
  - Day navigation: previous day, a "Go to date" field (no later than today), next day (not on today), and "Today".
  - The editor: a text field labelled with the date, the shared 10,000-character counter, Save, and Delete (with a confirmation) when the day has an entry. "Unsaved changes" shows while the text differs from the saved one; a new editor per date keeps one day's draft off another.
  - "Past entries": newest first, the date and the first line of each, the open day marked, 20 at a time with "Load more".

## Tests

- `backend/test/journal.test.ts` (new, no DB): wrong date formats, a date that does not exist, year 0000, a date after today, a missing, blank, non-text, too long, or NUL text, a title field, a page size over 100, and an unknown list filter are refused with 400 before any query; exactly 10,000 characters with CRLF is accepted and reaches the database trimmed and with LF.
- `backend/test/journal.integration.test.ts` (new, needs `TEST_DATABASE_URL`, own schema `test_journal`, the migration applied twice): saving twice on one date gives 201 then 200 with one row, the same `createdAt`, and the new text; an empty day is 404; the list pages newest first with `nextOffset` and `total`; delete is 204 then 404. The database itself refuses an empty body and a second row for a date.
- `backend/test/openapi.test.ts`: the router list knows `/api/journal`.
- `frontend/src/journal.test.tsx` (new): writes an entry for today, reloads, and sees it in the editor and at the top of the list; saving again updates the one entry; a refused save shows the server's message and keeps the text; past days open from the list, previous and next day, and the date field; a future or unreal date address goes to today; delete asks first and empties the day and the list; the list loads more 20 at a time.

## Limits and follow-up

- Export and restore (#208, #209) are not on `main` yet, so the journal table is not in the export. When #208 merges, the table has to be added to export and restore (the lane rules put that on the lane that owns the table).

## Verification

- With the shared lock and `TEST_DATABASE_URL` on a fresh lane DB: `tsx --test backend/test/journal.test.ts backend/test/journal.integration.test.ts backend/test/openapi.test.ts`: first run 20 passed, 1 failed (a test used `2026/11/26`, whose slashes make another route and a 404; it now uses `26-11-2026`), then 14 of 14 in `journal.test.ts`.
- `vitest run src/journal.test.tsx`: 7 passed.
- Merged `origin/main` (#212 statistics): `app.ts`, `openapi.test.ts`, and `app.tsx` kept both sides; `docs/openapi.json` regenerated (10 paths).
- Browser: Vite on 127.0.0.1:5214 with `/api/*` stubbed by Playwright (24 entries in November 2026, today 2026-11-26), Chrome.
  - 1440×900 and 390×844: no horizontal page overflow; the day navigation wraps on the phone; the list shows 20 entries and "Load more".
  - Keyboard: typing in the entry and one Tab reaches Save; Enter saves, "Saved" appears, and the entry is first in the list.
  - Console: the expected 404 for a day with no entry, and 403s for the Pretendard font files (this worktree's `node_modules` is outside the Vite allow list); not related.
- `npm run check` and `npm run knip` with `TEST_DATABASE_URL` on a fresh lane DB (migrations 001-010, 012): pass. Backend 234 passed, 0 skipped; frontend 364 passed, 3 skipped (existing); contract 3; skills 4; build passed; knip shows only its two existing configuration hints.

## Review round 1

- issue: after a delete the Delete button is gone, so the confirmation dialog had nowhere to return the focus. It now returns it to the entry field (`returnFocusRef`). The delete screen test checks the focus; it fails without the fix.
- nit, left as is: an unsaved draft is dropped without a warning when moving to another day (each day gets a fresh editor); while a new day loads after a failed one, the old error stays until the answer arrives (shared `useSettledError` behavior).
- Checked, no change: the date is validated before any query, the upsert relies on the unique date so two saves cannot create two rows, the counter and the server count characters the same way, and the integration test runs in its own schema.
- `vitest run src/journal.test.tsx`: 7 passed.
- `npm run check` and `npm run knip` with `TEST_DATABASE_URL` after the fix: pass (backend 234/0 skipped, frontend 364 passed + 3 skipped).
- Merged `origin/main` (#217 book quotes, migration 011): `docs/openapi.json` took main's version and was regenerated (12 paths). The journal module now uses the shared `isStorable` from `backend/src/validation.ts` (added by #217) instead of its own copy. Migration 012 stays next after 011.
- `npm run check` and `npm run knip` with `TEST_DATABASE_URL` (fresh DB, migrations 001-012) after the merge: pass. Backend 253 passed, 0 skipped; frontend 365 passed, 3 skipped (existing); contract 3; skills 4; build passed.
- Merged `origin/main` again (#216 tag filters) without conflicts; `docs/openapi.json` stayed current after `npm run openapi`.
- `npm run check` and `npm run knip` with `TEST_DATABASE_URL` after that merge: pass (backend 258/0 skipped, frontend 367 passed + 3 skipped).

## Owner decision: optional title

- `database/migrations/012_journal_entries.sql`: a nullable `title` column with `journal_entries_title_check` (NULL, or 1 to 200 characters). The migration is not on `main` yet, so it is changed in place.
- `backend/src/journal.ts`: `entryInput` takes an optional `title` (text, trimmed, at most 200 characters, no NUL or lone surrogate); a missing, null, or blank title is stored as null. `PUT` writes and replaces the title with the text, so saving without a title removes it. Every answer has `title`. `backend/src/openapi.ts` and `docs/openapi.json` (regenerated) describe it.
- `frontend/src/journal.tsx`: a "Title (optional)" field above the text (`maxLength` 200), counted in "Unsaved changes", sent trimmed or as null; the past-entries list shows the title between the date and the first line.
- Tests: `backend/test/journal.test.ts` (a title over 200 characters, not text, or with NUL is refused; a 200-character title is trimmed; a blank or null title is stored as null; an unknown field is still refused), `backend/test/journal.integration.test.ts` (a Korean title round-trips trimmed, a save without a title clears it, the CHECK refuses an empty or 201-character title), `frontend/src/journal.test.tsx` (a title is saved trimmed, shown in the list, and cleared as null).
- `origin/main` merged in (#214, #226 and others); no conflicts.
- `npm run check` (2026-11-26, after merging `origin/main`, without `TEST_DATABASE_URL`: the local DB credentials were not available to the agent): pass. Backend 287 tests, 242 pass, 0 fail, 45 skipped (the DB tests); frontend 375 passed, 3 skipped; skills 4 pass; build passes. The DB tests run in CI against its own Postgres.
