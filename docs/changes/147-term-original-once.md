# #147 Show the original term name only when it differs

- Issue: [#147](https://github.com/sirloinbh/life-journal/issues/147)
- Branch: `fix/147-term-original-once`

## Purpose

After the terms were translated to English, `original` equaled `term` in all 300 entries of `backend/src/terms-data.ts`. The term card printed both, so every card title read the name twice ("Cabernet Sauvignon Cabernet Sauvignon"), on screen and for screen readers.

## Changes

- `StudyTerm.original` is optional and documented as "only when it differs from `term`". All 300 copies were removed; none of the entries had a different original-language form, so no entry keeps one.
- `backend/test/terms.test.ts`: a new test fails if any entry has an `original` equal to its `term` (ignoring case and spaces) or a blank one. The "text in every field" test no longer requires `original`.
- `frontend/src/terms-study.tsx`: `original` is optional; the card prints it only when present and different from the name, and search skips a missing one.
- `frontend/src/terms-study.test.tsx`: fake terms have no `original` except Terroir (`Le terroir`, a real different form) and Montage (a copy, to check it is not printed twice). The heading tests check the exact text, and the original-word search uses a word only the original contains.
- The API keeps the same shape; `original` is simply absent when there is none. `GET /api/terms` has no response schema in `openapi.ts`, so nothing changed there.

## Verification

- `npm run test -w backend`: 143 pass, 0 fail (24 DB tests skipped without `TEST_DATABASE_URL`).
- `npm run test -w frontend -- src/terms-study.test.tsx`: 22 passed.
- Browser: Vite on 5204 with `/api/terms` stubbed by Playwright with the real 300 terms from `terms-data.ts`, Chrome at mobile 390×844 and PC 1440×900, all six domains: 50 card headings each, no heading repeats its name, no horizontal overflow, 0 console errors.
- `npm run check`: see the PR body.

## Limits

- The real API with a database was not started for the browser check; the stub served the same data the API returns.
