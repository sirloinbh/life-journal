# #146 Derive category rules on both sides from shared/contract.ts

- Issue: [#146](https://github.com/sirloinbh/life-journal/issues/146)
- Branch: `refactor/146-shared-category-contract`

## Purpose

The categories, subtypes, detail fields, rating criteria, scores and review limits were written by hand in `backend/src/items.ts` and again in `frontend/src/items.ts`, and the tests on both sides copied the criteria keys. A drift between them showed only as a 400 at run time.

## Changes

- `shared/contract.ts` (new): a plain data table of the categories in menu order (key, label, description, subtypes, detail fields with their type and maximum length, criteria), `SCORES`, `MAX_REVIEW_LINES`, `MAX_REVIEW_LENGTH`, `CategoryKey` and `CATEGORY_KEYS`. It has no imports. `npm run contract:sync` copies it to `backend/src/contract.ts`, and `npm run contract:check` (part of `npm run check`) fails when the copy differs. This turns on the opt-in shared contract (ADR-0026) that project-standards#783 had removed while it was unused.
- `backend/src/items.ts`: the category Zod schemas are built from the table (a text field from its `maxLength`, a year field from `type: 'year'`, criteria and subtypes from their lists); the score check uses `SCORES` and the review checks use the shared limits. The error messages are unchanged.
- `frontend/src/items.ts`: `categories`, `SCORES` and the review limits come from the table. The exported names and the `Category` shape are unchanged, so no screen file changes. `numberOrText` is exported for its test.
- Tests: `bucket-list.test.tsx` and `backend/test/items.test.ts` walk the table instead of copied keys. New `backend/test/category-contract.test.ts` checks that the latest `items.category` CHECK in `database/migrations` lists the same keys as the table (so a new category without a migration, or the reverse, fails), and that the lists in the table have unique keys. New `frontend/src/items.test.ts` covers `numberOrText`, `measureReview`, `reviewPreview`, `ratingSummary`, and that the screen categories follow the table.
- Adding a category now takes an entry in `shared/contract.ts` and a migration.

## Verification

- A one-off script compared the old hand-written frontend `categories`, `SCORES` and review limits (from `origin/main`) with the derived ones: equal.
- `npm run test -w backend`: 146 pass, 0 fail (24 DB tests skipped without `TEST_DATABASE_URL`). The existing message tests pass unchanged.
- `npm run test -w frontend -- src/items.test.ts`: 13 passed.
- Browser: Vite on 5204 with the API stubbed by Playwright, Chrome at mobile 390×844 and PC 1440×900, `/bucket-list/drink`: the add form shows Producer, Region and Vintage (`inputmode="numeric"`), and the rating form shows Overall rating, Aroma, Taste, Lingering impression and Value; no horizontal overflow, 0 console errors.
- `npm run check`: see the PR body.

## Limits

- The central registry marks this app's `features.contract` as `false` (project-standards#838). `.standards/check.mjs` does not read that flag, but the registry entry should be turned back on in `sirloinbh/project-standards`.
- The DB CHECK test reads the migration files as text; it expects the `category IN (...)` form the existing migrations use.
