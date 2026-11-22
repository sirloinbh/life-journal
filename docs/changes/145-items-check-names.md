# #145 Name the items CHECK constraints

- Issue: [#145](https://github.com/sirloinbh/life-journal/issues/145) (parent epic #138)
- Branch: `chore/145-items-check-names`

## Purpose

Every CHECK on `items` from migrations 002-005 was unnamed, so PostgreSQL generated names (`items_check`, `items_check1`, ...) that depend on the order the constraints were created. `007_coffee_category.sql` drops the old category CHECK by the generated name `items_category_check` with `IF EXISTS`; had the name been different, the drop would do nothing and the old CHECK would keep rejecting `coffee`. The status/date rule reported as `items_check`.

## Changes — 2026-11-23

- `database/migrations/009_items_check_names.sql` (new; `008` is `008_audit_log.sql` on main). One `DO` block:
  - Finds each CHECK by the columns it uses (`pg_constraint.conkey`) and renames it with `ALTER TABLE ... RENAME CONSTRAINT`. A rename does not re-check the rows, so it is cheap on a filled table.
  - Names: `items_category_check`, `items_title_check`, `items_status_check`, `items_cost_krw_check`, `items_details_check`, `items_status_dates` (status ↔ completed date), `items_rating_check`, `items_sub_ratings_check`, `items_review_check`, `items_link_check`.
  - Fails with `items has no CHECK on (<columns>) to name <name>` when an expected CHECK is missing, and when more than one unnamed CHECK uses the same columns, instead of skipping silently.
  - First drops a category-only CHECK that is not `items_category_check` and does not allow `'coffee'`: the old 002 CHECK that 007 would have missed under another name. `items_category_check` from 007 already allows every category.
  - Safe to run again: a CHECK that already has its name is skipped.
- `backend/test/db.integration.test.ts`: the "applied again" test also re-applies `009` twice.

## Tests

`backend/test/items-check-names.integration.test.ts` (new, needs `TEST_DATABASE_URL`):

- After `db:migrate`, the CHECK names on `items` are exactly the 10 names above.
- In a scratch schema built from 002-005 and 007 (generated names, starting with `items_check`), `009` runs twice and leaves the 10 names; a wishlist item with a completed date is refused by `items_status_dates`.
- With an extra old category CHECK under another name (rejects `coffee`), `009` drops it, the names are the 10 above, and a `coffee` item is stored.
- With `items_link_check` dropped, `009` fails with `items has no CHECK on (link) to name items_link_check`.

The scratch-schema tests use their own schema so they do not lock the shared `items` table.

## Verification — 2026-11-23

- Applied with the runner (`npm run db:migrate`, `Applied: 009_items_check_names.sql`) to a throwaway PostgreSQL 17 (`postgres:17-alpine`, `journal_test`), then again with `psql -v ON_ERROR_STOP=1` (CI applies files with psql first): both pass, names as listed.
- `grep` finds no code that refers to a generated constraint name.
- `npm run check` with `TEST_DATABASE_URL` set to that DB (migrations 001-009 applied): pass. Backend 171 passed, 0 skipped; frontend 263 passed, 3 skipped (existing); contract 3 passed; skills 4 passed; build passed.
- No screen change, so no browser check.

## Review — 2026-11-23

- Round 1 (self-review of head `c36cf71`): no findings that need a change, so no second round.
  - The first commit's record said `db.integration.test.ts` re-applies `009`, but that edit had not been applied; `c36cf71` added it before the review (21 DB tests pass).
  - Checked: `NOT LIKE '%''coffee''%'` matches `pg_get_constraintdef` output (`'coffee'::text`), so 007's `items_category_check` is never the one dropped; a re-run from `001` on a DB with no record table is safe (`003`-`005` skip `ADD COLUMN IF NOT EXISTS` with its CHECK, `007` re-adds `items_category_check` by name, `009` then skips every name); the runner and psql both accept the `DO` block.
