# #213 Show planned and completed dates on a monthly calendar

- Issue: [#213](https://github.com/sirloinbh/life-journal/issues/213)
- Branch: `feat/213-monthly-calendar`

## Purpose

Planned and completed dates are stored on every item but can only be read in the list and the table. A month calendar in the app shows them by day, with no outside service (the Google Calendar work, #87, is a separate sync).

## Changes

- `backend/src/calendar.ts` (new): `GET /api/calendar?month=YYYY-MM` answers `{ month, items }`: every item whose planned or completed date is inside the month, ordered by its earliest date in the month, then id. Without `month` it uses the month of today in Asia/Seoul. The month runs from its first day up to the first day of the next one, computed by PostgreSQL, so December rolls into the next year and `9999-12` still works. A month that is not a real `YYYY-MM` (or a repeated or unknown parameter) answers 400 before any query. Each item carries only what the calendar shows: id, category, subtype, title, status, planned and completed date, rating.
- `backend/src/app.ts`, `backend/src/openapi.ts`, `docs/openapi.json`: the route is mounted at `/api/calendar` and documented.
- `frontend/src/calendar.tsx` (new), `frontend/src/app.tsx`: a "Calendar" menu entry and the page `/calendar/:month`. The address holds the month (and `?day=` for the open day), so back, reload, and links keep them; an address without a valid month goes to this month.
  - Previous month, next month, and "This month" are links. An item appears on its planned day as "Planned" and on its completed day as "Done", each with its own icon and a hidden word for screen readers, so the two are not told apart by color. A legend names the icons.
  - From 768 px wide the month is a 7-column grid starting on Sunday; a day shows three entries and counts the rest. On smaller screens it is a list of only the days that have items, with every entry shown.
  - Only days with items are buttons, so the keyboard stops only there. A day's button names the date and the count ("November 8, 2026: 1 done"). It opens a dialog with each entry's kind, category, rating, and a link to the item on the bucket list (`/bucket-list/<category>#item-<id>`).
  - The dialog has no trigger of its own (the address opens it), so closing it puts the focus back on the day's button.
  - A month with no items says so; a failed load shows the error and "Try again".

## Tests

- `backend/test/calendar.test.ts` (new, no DB): a full date, month 13, month 00, year 0000, a two-digit year, two months, and an unknown filter are refused with 400 without touching the database; without `month` the query asks for the month of `today` (`2027-01-01` → `2027-01`).
- `backend/test/calendar.integration.test.ts` (new, needs `TEST_DATABASE_URL`): in its own schema (`test_calendar`, migrations 002-005, 007, 009) so other test files that empty `items` cannot interfere. November 2026 returns exactly the items dated Nov 1 through Nov 30 (Oct 31 and Dec 1 are left out), an item planned in October and completed in November is included once, and the order and fields match. December 2026 and December 2025 return their own items, and `9999-12` answers 200.
- `backend/test/openapi.test.ts`: the router list knows `/api/calendar`.
- `frontend/src/calendar.test.tsx` (new): opens on this month (Nov 10, 2026 in Seoul), places planned and done entries on their days with words, and has buttons only on days with items; moves to next month, opens a day, sees the entry with its link and opens the item on the bucket list; reload with `?day=` reopens the day, and closing it clears the address and focuses the day's button; an empty month says so and "This month" returns; an invalid month address goes to this month; a failed load offers a retry; months step across years and stop at 0001-01 and 9999-12.

## Verification

- `tsx --test test/calendar.test.ts test/openapi.test.ts`: 13 passed.
- `vitest run src/calendar.test.tsx src/app.test.tsx`: 15 passed.
- First `npm run check` (with `TEST_DATABASE_URL` on a new local `journal_test`, migrations 001-009 applied by the runner): failed at lint (an import order, a non-component export from `calendar.tsx`, and an async fake without await). The month helpers moved to `frontend/src/calendar-month.ts` and the fake returns promises.
- Browser: Vite on 127.0.0.1:5214 with `/api/*` stubbed by Playwright (13 items in November 2026, today 2026-11-26), Chrome.
  - 1440×900: a 7-column grid from Sunday, Nov 1 under Sunday, "+1 more" on a day with four entries, today highlighted, no horizontal overflow.
  - 390×844: a list of only the eight days with items, each with all entries, no horizontal overflow.
  - Keyboard: Tab from "Next month" reaches the first day with items (empty days are skipped), Enter opens the dialog with the focus on Close, Escape closes it. The first run showed the focus was lost after closing (fixed above, now it returns to the day). A link in the dialog opens `/bucket-list/reading#item-12`.
  - Console: only 403s for the Pretendard font files, because this worktree's `node_modules` is outside the Vite allow list; not related to this change.
- Second `npm run check` with `TEST_DATABASE_URL` (shared local `journal_test`): pass. Backend 201 passed, 0 skipped (including the new calendar integration test); frontend 327 passed, 3 skipped (existing); contract 3; skills 4; build passed.

## Review round 1

- issue: the month links were inside the component keyed by month, so pressing "Next month" with the keyboard remounted it and dropped the focus. The page no longer keys the month view, and "This month" is always shown (with `aria-current="date"` on this month) so the link pressed stays on the page. The screen test now checks that "Next month" keeps the focus; it fails with the old key.
- nit: `aria-live` on the month heading never announced anything (the heading was new on each month), so it was removed.
- Checked and left as is: the month range is computed by PostgreSQL (no JavaScript date math on the server), invalid months never reach the database, the integration test runs in its own schema, and only days with items take keyboard focus.
- `vitest run src/calendar.test.tsx`: 7 passed.
- `npm run check` with `TEST_DATABASE_URL` after the fix: pass (backend 201 passed, 0 skipped; frontend 327 passed, 3 skipped; contract 3; skills 4; build).

## Review round 2

- issue: the day button held a `<ul>`, which a button may not contain (phrasing content only). The entries are now spans; the grid still hides the fourth and later entries.
- nit: a needless `cn()` around a fixed class string was removed.
- `vitest run src/calendar.test.tsx`: 7 passed. Browser at 1440×900: the Nov 3 button shows three of its four entries; at 390×844 all four.
- `npm run check` with `TEST_DATABASE_URL` after the fix: pass (backend 201 passed, 0 skipped; frontend 327 passed, 3 skipped; contract 3; skills 4; build).
