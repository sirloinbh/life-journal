# Show reload failures and save with one round trip

- Issue: [#150](https://github.com/sirloinbh/life-journal/issues/150) (epic #137 Reliable bucket list screens)
- Branch: `fix/150-reload-failures`

## Problem

- After a save, the bucket list form waited for a full `GET /api/items` reload although `keepSaved` had already put the server's answer on screen. Reopen and delete waited the same way.
- A reload that failed after the first load was silent: the error showed only while there was no list yet, so the screen kept stale data with no message. The terms screen had the same gap.
- `LoadFailed` had no `try/finally`, so a reload that rejected left Try again disabled for good.

## Change

- `bucket-list.tsx`: `save` and `changeFromDialog` start the reload in the background (`void reload()`), so the form and the confirm dialog close as soon as the change is confirmed. A failed reload no longer blocks them.
- `bucket-list.tsx`, `terms-study.tsx`: when a reload fails while a list is on screen, `LoadFailed` (the server message and Try again) shows above the list, which stays. A successful retry removes it.
- `load-failed.tsx`: the retry wraps the reload in `try/finally`, so the button comes back even if the reload rejects; the rejection is swallowed at the click, since reporting it is the reload's job.

Wording: no new text. The background failure reuses the message and the Try again button of the first-load failure, the same as the table view (decision asked to the coordinator, see "Check before merging").

## Verification

- Tests:
  - `load-failed.test.tsx` (new) "Try again comes back after a reload that rejects".
  - `bucket-list.test.tsx` "a save closes the form and shows the item without waiting for the list" (add and delete while the list request is held), "a failed reload after the first load keeps the list, says so, and can be tried again", and "changes show the server response even when the reload after them fails" now expects the reload failure to be reported.
  - `terms-study.test.tsx` "a failed refresh keeps the terms on screen, says so, and can be tried again".
  - With the `origin/main` versions of the three components, these 5 tests failed; with the change they pass. `npm run test -w frontend -- src/load-failed.test.tsx src/bucket-list.test.tsx src/terms-study.test.tsx`: 80 passed.
- Browser (Playwright Chromium, frontend dev server on a temporary port with a temporary in-memory stub API whose list answer can be made to fail; frontend-only change):
  - Bucket list, 1440×900: with the list failing, saving an edit closed the form at once, kept the 31 items, showed "Saved" and the "A server error occurred" alert with Try again above the list. With the list back, Try again removed the alert and button.
  - Bucket list, 390×844: deleting an item with the list failing closed the dialog, removed the item, showed "Deleted" and the alert with Try again. No horizontal page overflow.
  - Terms, 390×844 and 1440×900: marking a term the server no longer had showed "Tannin: Term not found" (and "Terroir: …" on PC) and the reload failure with Try again while the terms stayed; Try again then refreshed the list and removed the failure. No horizontal page overflow.
  - Console errors were only the 404 and 500 responses triggered on purpose.
- `npm run check`: see below.

### `npm run check` (2026-11-23)

- Pass. Format, lint, contract, typecheck, backend 148 passed and 25 DB tests skipped (no `TEST_DATABASE_URL`, so the DB is not verified), frontend 273 passed and 3 skipped, skills 4 passed, build.

## Review round 1 — 2026-11-23

Self-review of head `685d426` (std-code-review section 8). Decision: approve, no blocking comments. Checked the order of background reloads (a stale list read before a second change is dropped by the `latest` counter), the unchanged 404 refresh paths, and that `LoadFailed` remounts per failure. Two non-blocking notes left as they are: "Saved" and the reload error can show together (both are true), and Try again still disables itself while retrying (existing first-load behavior).
