# #148 Pin all study term ids and store the range as data

- Issue: [#148](https://github.com/sirloinbh/life-journal/issues/148)
- Branch: `chore/148-pin-term-ids`

## Purpose

A learned mark is stored by term id in `learned_terms`, and `GET /api/terms` ignores ids it does not know. Only 12 of the 300 ids were pinned by a test, so renaming any other id would silently drop its marks. The range a term belongs to (Grapes, Regions, ...) existed only in comments, so the tests could check a range only through one sample term.

## Changes

- `backend/src/terms-data.ts`: `StudyTerm` has a `range` field, filled for all 300 terms from the range comments (24 ranges, 4 per domain). `TERMS` is `readonly Readonly<StudyTerm>[]`. The `id` comment says an id is never renamed or removed.
- `backend/test/term-ids.txt` (new): all 300 ids, one per line, taken from `origin/main` before this change.
- `backend/test/terms.test.ts`: a new test fails when an id in the snapshot is missing from the data (renamed or removed) or a new id is not in the snapshot. The per-domain test now checks the real `range` of every term: each domain's ranges appear in the expected order, each as one block, and the sample terms carry their range. The whisky tasting range is named "Tasting and drinking" as in its comment.
- `GET /api/terms` now also sends `range` for each term (the spread of the term object). The screen does not use it yet.
- No migration: `learned_terms` is unchanged.

## Verification

- `npm run test -w backend`: 153 pass, 0 fail (DB tests skipped without `TEST_DATABASE_URL`).
- Checked once by hand: renaming `wine-merlot` to `wine-merlot-x` fails "every term id is pinned, and none is renamed or removed" with "renamed or removed ids: learned marks would be lost"; the rename was reverted.
- No browser check: no screen file changed.
- `npm run check`: see the PR body.
