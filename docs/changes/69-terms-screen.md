# #69 Terms study screen

- Issue: [#69](https://github.com/sirloinbh/life-journal/issues/69)
- Branch: `feat/69-terms-screen`

## Changes — 2026-11-02

Added a screen where you pick an area, see terms and their meanings, search, and mark terms you have memorized. You reach it from "용어 공부" (Terms study) in the main menu.

- Areas: wine, whisky, literature, film, opera, and musical. Each area has 2 example terms, and the rest are filled in #70 to #73.
- Terms are kept in `backend/src/terms-data.ts`. They cannot be added or edited in the app.
- Only the memorized marks are stored, in the new table `learned_terms` (migration `006`).
- API: `GET /api/terms`, `PUT` and `DELETE /api/terms/:id/learned`. A term that is not in the data is rejected with a Korean 404.
- Search looks for the term, the original word, and the meaning within the current area. It is not case sensitive. When you move to another area, the search text is cleared.
- The checkbox of a term that is being saved does not send a request when clicked again. It is not disabled so that keyboard focus is not lost.
- Moved the area tabs and the load-failed display to `category-tabs.tsx` and `load-failed.tsx` and share them with the bucket list.

The decisions are in the [issue comment](https://github.com/sirloinbh/life-journal/issues/69). Quizzes and flashcards were not added.

## Tests

- `frontend/src/terms-study.test.tsx`: showing per area, search, keeping and clearing the memorized mark, failure, double clicks, a term that disappeared, and retrying the list
- `backend/test/terms.test.ts`: IDs, areas, and duplicate names of the term data, and a 404 for a term that does not exist
- `backend/test/db.integration.test.ts`: saving and clearing the memorized mark, repeated requests, a term that disappeared from the data, and re-running the migration

## Verification

- `npm run check`: pass (backend 126 passed, frontend 144 passed, 2 skipped, skills 4 passed). The DB integration tests ran with `TEST_DATABASE_URL` set.
- Browser: we started the real API, Vite, and the test DB and drove headless Chrome through the DevTools protocol. At mobile 390×844 (emulation without touch) and PC 1440×900 we checked moving to the first area, the memorized mark and count, keeping it after a reload, search with real key input, moving between areas, and clearing the mark. The page did not overflow horizontally and there were 0 console errors. We also looked at the captured screens.

## Review

We applied the 4 findings of the first round.

- A save failure message stayed on another area tab. It is cleared when the area changes.
- If another term finished being marked while the list was being fetched, that list was discarded, so the refresh after a 404 could be lost. We now request the list again.
- There was no test that catches the behavior above, so we added one.
- Fixed the #73 description in the next-steps document and the scope of the browser check.

We applied the 1 finding of the second round. If you moved the area while saving, the failure message appeared on the tab you moved to, and you could not tell which term it was about. We put the term name in the message and added a test.

The browser check was done before the first-round fix, and the review fixes were checked with the screen tests.

## Limits

- On an existing DB, `006` must be applied with the method in `database/README.md`.
- The memorized mark of a term removed from the data stays in the DB but is not shown on the screen.
- We could not check on a real touch device.
- The JS file of the frontend build grew from 498.69kB to 506.81kB, so Vite's 500kB warning appears for the first time. The build does not fail. #70 to #73 only grow the backend data and do not increase this size.
