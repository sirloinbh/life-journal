# #74 Add the new area coffee

- Issue: [#74](https://github.com/sirloinbh/life-journal/issues/74)
- Branch: `feat/74-coffee-category`

## Changes — 2026-11-03

Added a sixth area, "커피" (coffee), to the bucket list. You can add items, complete them, and leave ratings and reviews. The decisions made before starting are in the [issue comment](https://github.com/sirloinbh/life-journal/issues/74#issuecomment-6606545493).

- Area: a new area `coffee`, separate from alcohol. It has no subtypes.
- Details: roastery (`roastery`), origin (`origin`), and brew method (`brewMethod`). All are optional free input. The user added the brew method to the card recommendation.
- Detailed ratings: aroma (`aroma`), acidity (`acidity`), sweetness (`sweetness`), body (`body`), and finish (`finish`).
- DB: migration `007_coffee_category.sql` drops the `items_category_check` constraint and re-creates it with `coffee` added. It is safe to run again because it drops by name and re-creates. It is wrapped in one transaction.
- Backend: put the area list `CATEGORY_KEYS` in `backend/src/items.ts`, and made area validation, the list filter, and area sorting share this list. Before, the same array was written separately in three places. The keys of the `CATEGORIES` object are still written separately, but a type error occurs with `satisfies` if they do not match `CATEGORY_KEYS`.
- Frontend: added coffee to the area definitions in `frontend/src/items.ts`. The tabs, the item form, the rating form, and the table view area filter follow this definition.
- OpenAPI: the repository has no OpenAPI document yet (`docs/project-setup.md` says to create one when external clients appear). So we did not update it.
- On an existing local DB, apply `007` with the method in `database/README.md`. We changed the guidance in `docs/next-steps/README.md` to `002` to `007`.

## Tests

- `backend/test/items.test.ts`: details that coffee does not have, a subtype, a non-string detail value, and detailed ratings that coffee does not have are rejected with a Korean 400. The 5 detailed ratings of coffee and both ends of the score are accepted.
- `backend/test/db.integration.test.ts`
  - Create and read items of the 6 areas on a real DB. For coffee, make a completed item with 3 details, an overall rating, and 5 detailed ratings.
  - Applying `007` twice to a table that has existing items gives no error. Before applying, coffee is rejected, after applying it is saved, and an unknown area is still rejected. Existing rows stay as they are.
  - Added `007` to the list of re-run tests.
  - This test grabs a single connection and uses it directly, because `pool.query` discards a connection that had an error, and the `search_path` setting would be lost.
- `frontend/src/bucket-list.test.tsx`: on the coffee tab, add, edit, complete, cancel completion of, and delete an item. The rating form shows the 5 detailed ratings and sends them.
- `frontend/src/items-table.test.tsx`: picking coffee in the table view area filter queries again with `category=coffee`, and "커피" (coffee) appears in the row.

## Verification

- `npm run check`: pass (backend 146 passed, 0 skipped, frontend 150 passed, 2 skipped, skills 4 passed). The DB integration tests ran with `TEST_DATABASE_URL` set.
- Browser: we started the real API, Vite, and the test DB and drove headless Chrome 156 through the DevTools protocol. It passed at both mobile 390×844 (mobile emulation without touch) and PC 1440×900.
  - From the first screen, moving to the coffee tab, adding an item (3 details), keeping it after a reload, marking it complete, saving the overall rating and the 5 detailed ratings, the table view coffee filter, and delete
  - In both the list and the table view, the page did not overflow horizontally. On mobile the 6 tabs fit on one line.
  - There were 0 console errors and exceptions.
  - We looked at the captured screens of the item form, the rating form, the list, and the table view. They were temporary files, so we did not put them in the repository.

## Review

We applied the 2 findings of the first round (both low).

- The coffee migration integration test: if 007 failed inside the transaction, the connection stayed in an aborted transaction, so `DROP SCHEMA` in the cleanup step failed, and releasing the connection and ending the pool were skipped, so the test could hang. We now `ROLLBACK` before cleanup, and release and end in `finally`.
- Changed "four places" in this document to the real "three places" and wrote about the type check of the `CATEGORIES` keys.

After applying the first review, `npm run check`: pass (backend 146 passed, 0 skipped, frontend 150 passed, 2 skipped, skills 4 passed). The screen code did not change, so we did not redo the browser check.

Second review: both first-round findings were applied and there was nothing to fix. The out-of-scope problem it pointed out as well (there is no source for `dist/migrate.js`, which the deploy script runs) was split out as [#83](https://github.com/sirloinbh/life-journal/issues/83).
