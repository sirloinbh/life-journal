# #254 Keep exports restorable above 20 MB

Restore refused a body over 20 MB, but nothing bounds an export: a Notion page body may hold 2,000,000 characters (`notion_pages_body_check`), and the change history grows without limit. A backup could download and then fail to restore. User decision (option A): raise the limit and test a large file.

## The number: 100 MB

- One Notion page at the cap is 2,000,000 characters, up to about 6 MB in UTF-8 when it is Korean text (3 bytes per character), a little more with JSON escapes.
- 100 MB fits about 16 such pages beside the other tables, far above what one person imports, while still bounding the request. The old 20 MB held only 3.
- The 15 s statement timeout is per statement and the restore reads the body once; the large-file test runs the whole route on a 30 MB file.

## Changes

- `backend/src/restore.ts`: `RESTORE_BODY_LIMIT_MB = 100` replaces the `20mb` literal.
- `frontend/src/restore-file.ts`, `frontend/src/restore.tsx`: `MAX_RESTORE_BYTES` is 100 MB; the screen says "The file is larger than 100 MB".
- `docs/export-format.md`, `backend/src/openapi.ts`, `docs/openapi.json`: "up to 100 MB".
- Tests: a 30 MB file (five Korean Notion pages at the 2,000,000-character cap) is restored through the route; a file over 100 MB is still a 413; the frontend limit constant.

## Verification

Recorded in the PR (`npm run check`).
