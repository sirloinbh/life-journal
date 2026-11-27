# Skip Notion pages that are gone instead of failing the import (#252)

Before, a 404 or 403 from Notion on any page, database, block list, or query ended the whole run as "failed", so one deleted or unshared child page blocked every import and nothing was marked removed.

## What changed

- `backend/src/notion-import.ts`: a 404 or 403 answer throws `NotionMissing` (a `NotionError`). The walk catches it for a page's blocks, a database query, and a child page lookup, counts it in the new `skipped` figure, and continues. A skipped page is not added to `seen`, so the end of the run marks it removed from Notion. A 401, a network error, and every other status still fail the run, and a failed run still deletes nothing.
- `frontend/src/documents-import.tsx`: the Settings result line adds ", N pages skipped because Notion no longer shows them" when `skipped` is above 0.
- `backend/test/notion.integration.test.ts`: a run with a page that is gone (its child included) finishes as done and marks them removed.

## Results

See the PR for `npm run check`.
