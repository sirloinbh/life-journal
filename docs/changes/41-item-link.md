# #41 Save a reference link on an item

- Issue: [#41](https://github.com/sirloinbh/life-journal/issues/41)
- Branch: `feat/41-item-link`

## Purpose

The alcohol area has no official API, so we chose manual entry plus a link (#24). We save the reference link the user pastes and open it on click.

## Decision

The user decided in an issue comment to add a link field to every area. We do not add alcohol-specific input items such as alcohol content.

The values decided during implementation are as follows.

- Only `http` and `https` addresses are accepted, so that an address such as `javascript:` does not end up in the `href` on screen.
- Up to 2000 characters are accepted. Leaving it empty removes the link.
- The link stays when completion is cancelled, because it is reference information of the item, not a completion record.
- The server does not send requests to the link address.

## Changes — 2026-10-31

- `database/migrations/005_item_link.sql`: `link` column. The DB also blocks the length and a start other than `http` or `https` with `CHECK`.
- `backend/src/items.ts`: link validation, save, and update.
- `frontend/src/bucket-list.tsx`, `frontend/src/items.ts`: the link field in the add and edit forms, and "링크 열기" (Open link) on the card (new tab, `noopener noreferrer`).

## Tests

- `backend/test/items.test.ts`: `javascript:`, `data:`, `ftp:`, a value that is not an address, and 2001 characters are rejected with a Korean 400. `fetch` is not called when saving.
- `backend/test/db.integration.test.ts`: re-applying the migration and applying it to a table with rows, save, keep, update, delete, and the DB `CHECK`.
- `frontend/src/bucket-list.test.tsx`: save, the new-tab link, clearing, and the rejection message.

## Next-steps document

At the user's request, we organized the remaining cards as tasks for tomorrow in `docs/next-steps/README.md`.

## Verification — 2026-10-31

Ran on Windows with a temporary PostgreSQL 17.11 set as `TEST_DATABASE_URL`.

- `npm run check`: pass. Backend 114 passed and 0 skipped, frontend 125 passed and 2 skipped (a condition of the dark-only app).
- `npm run knip`: pass.
- Browser: headless Chrome 156, mobile 390×844 (emulation without touch) and PC 1440×900. We checked the Korean error for a `javascript:` link, and the link address and new-tab attributes on the card. The existing flows passed again. The console had only the 400 response records that we triggered on purpose.

## Review — 2026-10-31

A separate agent reviewed head `4f86841`. There was nothing to fix, so there is no second review. The reviewer sent about 65 inputs to the real router and the test DB and confirmed that there is no 500 response and no dangerous `href` path.
