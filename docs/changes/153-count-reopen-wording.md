# Fix item count and reopen wording

- Issue: [#153](https://github.com/sirloinbh/life-journal/issues/153) (epic #137 Reliable bucket list screens)
- Branch: `fix/153-count-reopen-wording`

## Problem

The bucket list and the items table always said "items", so one item read "1 items". Reopening a done item read "Undo done?" and the message "Undid done".

## Change

- `items.ts`: `itemCount(n)` gives "1 item" for one and "<n> items" otherwise ("0 items", "2 items").
- `bucket-list.tsx` (category line) and `items-table.tsx` (result count) use it.
- `bucket-list.tsx` reopen texts, as the card sets: confirm title "Mark as not done?" and message "Marked as not done".
- The card does not set the buttons. The trigger ("Undo done", aria "Undo done for <title>") and the confirm button ("Undo done") now read "Mark as not done" (aria "Mark <title> as not done"), mirroring "Mark as done". This is option A of the decision asked to the coordinator (see "Check before merging" in the PR).

## Verification

- Tests: `bucket-list.test.tsx` "the count reads 1 item, and more than one as items" and "reopening a done item asks and reports \"Mark as not done\"", `items-table.test.tsx` "the count reads 1 item, and more than one as items". The 6 per-category flow tests and the reload test now open the reopen dialog by its new name. With the `origin/main` sources all 10 of these failed; with the change, `npm run test -w frontend -- src/items-table.test.tsx src/bucket-list.test.tsx`: 81 passed.
- Browser (Playwright Chromium, frontend dev server on a temporary port with a temporary stub API; frontend-only change): at 390×844 and 1440×900 the coffee tab read "Coffee to try and coffee tried · 1 item", reading "· 31 items", and the table filtered to coffee "1 item"; no horizontal page overflow. Reopening "데미안" showed the trigger "Mark as not done" (aria "Mark 데미안 as not done"), the dialog "Mark as not done?" with the buttons "Close" and "Mark as not done", then the status "Marked as not done" and the "Mark as done" button again.
- `npm run check`: see below.

### `npm run check` (2026-11-23)

- Pass. Format, lint, contract 3 passed, typecheck, backend 152 passed and 30 DB tests skipped (no `TEST_DATABASE_URL`, so the DB is not verified), frontend 285 passed and 3 skipped, skills 4 passed, build.

## Review round 1 — 2026-11-23

Self-review (std-code-review section 8). Decision: approve, no blocking comments. Both counts use the helper, "0 items" stays plural, no source, e2e test or doc still uses the old texts, and the new aria label mirrors "Mark <title> as done". The button wording beyond the card waits for the coordinator's answer.

## Decision — 2026-11-23

- The decision was answered on 2026-11-23: option A, both buttons read 'Mark as not done', recorded on #153.

## Merged `origin/main` after #150 — 2026-11-23

- #150 (PR #191) also changed `bucket-list.tsx` and its tests. The merge was automatic; no "Undo done" or "Undid done" is left in `frontend/src` or `e2e`.
- `npm run check`: pass. Backend 153 passed and 30 DB tests skipped (no `TEST_DATABASE_URL`), frontend 289 passed and 3 skipped, skills 4, contract 3, build.
