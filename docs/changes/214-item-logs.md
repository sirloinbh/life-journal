# Repeated tastings and visits under one item

- Issue: [#214](https://github.com/sirloinbh/life-journal/issues/214) (parent #206 Richer item records)
- Branch: `feat/214-item-logs`

## Problem

Each item has a single completed date, rating, and review (migrations `002` to `004`). Wine, whisky, and travel are often experienced more than once, and a second visit overwrote or lost the first.

## Decision

Recorded in [the issue comment](https://github.com/sirloinbh/life-journal/issues/214#issuecomment-7179535583). The coordinator was not available to ask and said to decide and report, so the issue's recommendation was taken:

- The item keeps its own completed date, rating, sub-ratings, and review as the first completion. A log is one more tasting or visit and never changes the item, so lists, statistics, and the calendar read the item as before.
- Logs are offered for Drinks and Travel first (`LOG_CATEGORIES` in `shared/contract.ts`; adding Coffee later is one entry there and one word in `frontend/src/items.ts`).
- An item with logs cannot move to another category until its logs are deleted (the same rule quotes use).
- Choices the issue did not set: the date is required and cannot be after today (as the completed date); the rating, note, and cost are optional; logs do not need the item to be marked done.

## Change

- `database/migrations/013_item_logs.sql`: table `item_logs` (`item_id` → `items` with `ON DELETE CASCADE`, `logged_on` date, `rating` 0.5-5 in 0.5 steps or null, `note` up to 500 characters and not blank or null, `cost_krw` 0 or more or null, `created_at`, `updated_at`) with named CHECKs and an index on `(item_id, logged_on DESC, id DESC)`. Safe to run again. Number 013 because the open #210 branch already uses 012.
- `shared/contract.ts` (+ backend copy): `MAX_LOG_NOTE_LENGTH = 500` and `LOG_CATEGORIES = ['drink', 'travel']`.
- `backend/src/item-logs.ts` (new), added to the items router:
  - `GET /api/items/:id/logs` → `{ logs }` newest first (two on one day: the one added last first). 404 for a missing item.
  - `POST /api/items/:id/logs` → 201. Other categories get `Only drink and travel items can have tastings and visits` (400). The item row is locked `FOR SHARE` while the log is added.
  - `PATCH /api/items/:id/logs/:logId` (partial) and `DELETE …/:logId` → 404 `Log not found` when the log is not under that item.
  - Validation like the item's: the rating uses the item rating rule, the cost the item cost rule, the date must be a real `YYYY-MM-DD` date not after today, and the note is trimmed with line ends stored as `\n` (a blank note is no note).
- `backend/src/items.ts`: an item PATCH that would move an item with logs to another category is refused with `Delete the tastings and visits of this item before moving it to another category`.
- `backend/src/validation.ts`: `date`, `score`, `costKrw`, `MAX_COST_KRW`, and `lines` moved here from `items.ts` and `item-quotes.ts` so the logs reuse the same rules without an import cycle. No behavior change.
- `backend/src/openapi.ts`, `docs/openapi.json`: the four routes; the item DELETE summary says its logs go with it.
- `frontend/src/item-logs.tsx` (new): the logs of an item in the item dialog, titled "Tastings" (drinks) or "Visits" (travel): newest first, each with its date, rating, the change from the rated log before it ("Up 1 since March 1, 2026", "Down 0.5 …", "Same as …"), cost, and note; a "Rating over time, oldest first: 3.5 → 4.5" line once two logs are rated; Edit in place and Delete with confirmation; an add form (date starting at today, rating, cost, note with a 500-character counter).
- `frontend/src/score-field.tsx` (new): the rating select, moved out of `bucket-list.tsx` so the log form uses the same one.
- `frontend/src/bucket-list.tsx`: a "Tastings" or "Visits" button on drink and travel items, opening that dialog.
- `frontend/src/items.ts`: `logWords(category)` and the `MAX_LOG_NOTE_LENGTH` re-export.
- `frontend/src/test/items-api.ts`: the fake API answers the log routes.

### Not in this PR

- Export (#208) and restore (#209): not merged yet, and other lanes do not touch the export code until #208 is merged. `item_logs` is a new table that must be added to both then (follow-up, together with `item_quotes` and the item tags and companions).

## Verification

- Tests added:
  - `backend/test/item-logs.test.ts`: 400s before any query for a missing, unreal, wrongly formatted, or future date, ratings 0, 5.5, 4.3, and text, a long note, a note that is not text, a NUL, a negative, fractional, or too large cost, an unknown field, malformed ids, an empty patch, a null date, a future date, and a bad rating in a patch; a log on today is allowed with its note trimmed to `\n` line ends and blanks stored as null; a patch sets only the named columns.
  - `backend/test/item-logs.integration.test.ts` (own scratch schema): the migration runs again; logs are added, listed newest first, edited (and re-sorted), and deleted, and the item's own status and rating stay as they were; a log under another item is 404; only drink and travel items take logs, a missing item is 404, an item with logs keeps its category until they are deleted, and other edits still work; logs go with their item; the table refuses bad ratings, notes, costs, a missing date, and an unknown item.
  - `frontend/src/bucket-list.test.tsx` "a wine keeps tastings newest first with the rating change, and only drinks and travel offer them (#214)": adds two tastings, checks the requests, the order, the change line, and the over-time line, edits one in place (focus in and back), deletes one (focus to the add form), and reading items have no button.
  - `frontend/src/items.test.ts`: `logWords` for each category.
- `npm test -w backend` (without the DB): 218 passed, 42 skipped. `npm test -w frontend -- src/bucket-list.test.tsx`: 67 passed. `npm run lint` and `npm run knip`: pass.
