# Link item titles in the table to the item itself

- Issue: [#149](https://github.com/sirloinbh/life-journal/issues/149) (epic #137 Reliable bucket list screens)
- Branch: `fix/149-item-title-link`

## Problem

In the items table, each title is a link, but it went to `/bucket-list/<category>`: the whole category list. It looked like it opened the item, but you then had to find the item yourself.

## Change

There is no page for a single item, so the link uses the second option the card allows: the category list with the item scrolled into view and selected.

- `items.ts`: `itemAnchor(id)` gives the element id `item-<id>`, shared by the link and the list.
- `items-table.tsx`: a title links to `/bucket-list/<category>#item-<id>`.
- `bucket-list.tsx`: each item `<li>` has that id and `tabIndex={-1}`. The linked item gets `aria-current="true"` and a ring in the card shape while the address points to it (changed in review round 1, below). `useLinkedItem` reads the address hash; once the item is on screen it scrolls it to the middle of the view and focuses it, so a screen reader also starts there. It runs once per hash, so a later reload after a save does not pull the focus back. An unknown item id leaves the list as it was.

No new screen text.

## Verification

- Tests added:
  - `items-table.test.tsx` "an item title opens that item on the bucket list, scrolled to and focused": the link targets `/bucket-list/reading#item-2`; clicking it opens the list, scrolls only that item into view and focuses it. The two existing link `href` checks now expect the anchor.
  - `bucket-list.test.tsx` "a linked item is focused once, and a later reload does not move the focus" and "an address with an unknown item shows the list without moving the focus".
- `npm run test -w frontend -- src/items-table.test.tsx src/bucket-list.test.tsx`: 76 passed (after the `href` fix).
- Browser (Playwright Chromium, frontend dev server on a temporary port with a temporary in-memory stub API, because the change is frontend only): at PC 1440×900, clicking "Book 25" of 32 items in the table opened `/bucket-list/reading#item-25` with that card focused and centered (top 367, bottom 549 of 900) and the focus ring visible. At mobile 390×844, "Book 12" opened `#item-12` centered (top 339, bottom 521 of 844). No horizontal page overflow and no console warnings or errors.
- `npm run check`: see the entry below.

### `npm run check` (2026-11-23)

- First run: failed in one backend test unrelated to this change. `backend/test/sign-in.test.ts` "without a session every /api path but /api/health is 401" got `TypeError: fetch failed` with cause `bad port`: the test listens on port 0, and this Windows machine's dynamic port range is 1024–15000, which includes ports that `fetch` refuses (such as 6000 and 10080). Reported separately.
- Second run: pass. Format, lint, contract (3 passed), typecheck, backend 166 tests (142 passed, 24 DB tests skipped because `TEST_DATABASE_URL` is not set, so the DB is not verified), frontend 42 files and 267 tests (264 passed, 3 skipped), skills 4 passed, build.

## Review round 1 — 2026-11-23

Self-review of head `1628e1c` (std-code-review section 8). Decision: changes needed, 1 finding.

| Finding                                                                                                                                          | Handling                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `issue:` the ring used `focus:` on a `tabIndex={-1}` `<li>`, so a mouse click on any card text focused the `<li>` and drew the ring on that card | The ring now follows the address: the linked item gets `aria-current="true"` (also read by screen readers) and the ring is styled from it. `focus:` styles removed |
| `nit:` unused `scroll-mt-4` (the item is centered)                                                                                               | Removed                                                                                                                                                            |

### Verification

- Tests: the focus test also checks that only the linked item has `aria-current`, and that focusing another card does not mark it; the unknown-id test checks no item is marked. `npm run test -w frontend -- src/items-table.test.tsx src/bucket-list.test.tsx`: 76 passed.
- Browser (same setup): at 390×844 and 1440×900 the linked item is focused, marked and ringed; clicking and focusing another card draws no ring on it. No page overflow, no console warnings or errors.
- `npm run check`: see below.

### `npm run check` after round 1 (2026-11-23)

- Pass. Format, lint, contract 3 passed, typecheck, backend 142 passed and 24 DB tests skipped (no `TEST_DATABASE_URL`), frontend 264 passed and 3 skipped, skills 4 passed, build.

## Review round 2 — 2026-11-23

Self-review of head `8566f47` and the full final diff. Decision: changes needed, 1 finding.

| Finding                                                                                                                                                              | Handling                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `issue:` `decodeURIComponent` on the hash threw `URIError` for a malformed address such as `/bucket-list/reading#%E0%A4%A`, which would crash the bucket list screen | The hash is compared as is (anchors are plain `item-<id>`), so nothing is decoded |

### Verification

- Test: "an address with the unknown item … shows the list without moving the focus" now runs for `#item-99`, `#%E0%A4%A` and `#item-1%`. With the round 1 code the two malformed cases failed with `URIError: URI malformed`; now `npm run test -w frontend -- src/items-table.test.tsx src/bucket-list.test.tsx`: 78 passed.
- `npm run check`: pass after formatting this record. Format, lint, contract 3 passed, typecheck, backend 142 passed and 24 DB tests skipped (no `TEST_DATABASE_URL`), frontend 266 passed and 3 skipped, skills 4 passed, build.
