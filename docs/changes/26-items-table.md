# #26 View items in a table with search and filters

- Issue: [#26](https://github.com/sirloinbh/life-journal/issues/26)
- Branch: `feat/26-items-table`

## Purpose

So that you can find the item you want quickly even as items pile up, search, filter, and sort all items in one table.

## Changes — 2026-10-31

- `backend/src/items.ts`: query parameters of `GET /api/items`: `q`, `category`, `status`, `from`, `to`, `costMin`, `costMax`, `sort`, and `order`. The values are validated with Zod, and sorting uses only fixed columns. If there are no parameters, it returns everything in recent order as before.
- `frontend/src/items-table.tsx`, `frontend/src/app.tsx`: the table view in the menu (`/table`). Filters and sorting stay in the address, so they are kept even after a reload.

The values decided during implementation are as follows.

- Search looks in the title and in the values of the per-area details. It is not case sensitive, and it does not look at the item names of the per-area details (such as `author`) or at the subtype. The subtype is stored as a code value (`opera`), so it cannot be searched by the text on screen.
- The area column is sorted in menu order.
- Case sensitivity for non-ASCII characters and the title sort order follow the DB locale. On a temporary DB with the `C` locale, `Émile` could not be found by `émile`, and uppercase sorted first. We did not check the locale of the production DB.
- Filtering and sorting do not add to the history (`replace`). Pressing back goes to the screen before you came to the table, not to the earlier condition.
- The period is based on the completion date, or on the planned date if there is none. Items with no date are left out of the period filter.
- Items with no cost are left out of the cost filter. In sorting, items with no value go last regardless of the direction.
- Text and date fields apply on Enter or when focus moves away. This is so that no request goes out in the middle of Korean text composition, and a date is not searched with a value that is still being typed. A select box applies as soon as you change it.
- Clicking a title in the table goes to the area tab of that item.
- We did not add pagination. It is not needed for the number of items of a single user.

## Tests

- `backend/test/items.test.ts`: an invalid condition is rejected with a Korean 400 before it reaches the DB.
- `backend/test/db.integration.test.ts`: only matching items return for each combination of search term and filters, `%` and `_` are searched as literal characters, and the sorting is correct.
- `frontend/src/items-table.test.tsx`: menu navigation, column display, re-fetching when a filter changes, keeping the conditions in the address, when input fields apply, sorting, error display, clearing the conditions, and ignoring a late old response.

## Verification — 2026-10-31

Ran on Windows with a temporary PostgreSQL 17.11 set as `TEST_DATABASE_URL`.

- `npm run check`: pass. Backend 95 passed and 0 skipped, frontend 111 passed and 2 skipped. The 2 skipped are the dark-only app condition (`runIf(DARK_ONLY)`) of a centrally managed test, which does not apply to this app.
- `npm run knip`: pass.
- Browser: headless Chrome 156, mobile 390×844 (emulation without touch) and PC 1440×900. With the real API and a temporary DB we checked menu navigation, search of per-area details, keeping the conditions after a reload, clearing the conditions, the status filter, rating sort, and the Korean error for an invalid cost. On mobile the table scrolls horizontally only inside the table (table 704px, area 356px) and the page does not overflow. The console had only the 400 response records that we triggered on purpose.

## First review applied — 2026-10-31

A separate agent reviewed head `076a46a`. We applied the 11 findings (1 blocking the merge, 3 to fix, 7 minor).

| Finding                                                                            | Handling                                                                                                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A date typed with the keyboard was filtered as a different date (blocks the merge) | Changed the date fields to uncontrolled inputs, applied on Enter or when focus moves away                                          |
| The search term `any` was not applied                                              | The "all" value is handled only in the select box                                                                                  |
| Applying removed focus from the input field                                        | Only the value is changed, without re-creating the input. After clearing the conditions, focus moves to the search field           |
| Test gaps                                                                          | Added tests for dates, `any`, focus, clearing values, back navigation, error recovery, `\` search, 0 won, and duplicate parameters |
| Could not retry after an error                                                     | Added a retry button                                                                                                               |
| The empty result guidance showed while loading or on an error                      | Show it only when there are no results after the answer arrives                                                                    |
| Area sorting did not match the screen                                              | Sort in menu order                                                                                                                 |
| Locale dependence of title sorting and search                                      | Left the code as is and recorded it as a limit                                                                                     |
| The subtype is not searched                                                        | Did not widen the scope, and recorded it                                                                                           |
| Input field heights misaligned at 1024px wide                                      | Shortened the label and moved the period description below the filter                                                              |
| The `replace` decision was not recorded                                            | Recorded it                                                                                                                        |

### Verification

- `npm run check`: pass. Backend 98 passed and 0 skipped, frontend 117 passed and 2 skipped (the dark-only app condition).
- `npm run knip`: pass.
- We typed dates with real key input in headless Chrome 156, at mobile 390×844 and PC 1440×900. While typing `2026`, →, and `0328`, the request and the address did not change, and when we left the field `to=2026-03-28` was applied. The application of the search term `any`, keeping focus, and the existing flows also passed.

## Second review applied — 2026-10-31

A separate agent reviewed head `fa635d5`. We applied all 4 findings (0 blocking the merge, 2 to fix, 2 minor). As the rule says, there is no third review.

| Finding                                                                         | Handling                                                                               |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Leaving the field with an incomplete or non-existent date cleared the condition | If `validity.badInput`, it is not applied, so the existing condition stays             |
| Clicking a header right after typing lost the search term just applied          | Read the current address instead of the value at render time, so both changes are kept |
| Clearing the conditions could not empty an incomplete date field                | Re-sync the input fields when the conditions are cleared                               |
| Pressing retry removed focus                                                    | Keep the button during the retry too                                                   |

The behavior of picking directly in the calendar popup could not be operated in a headless browser, so we could not check it. The selected value is applied when leaving the field, and the screen text says so.

### Verification

- `npm run check`: pass. Backend 98 passed and 0 skipped, frontend 120 passed and 2 skipped (the dark-only app condition).
- `npm run knip`: pass.
- In headless Chrome 156, at mobile 390×844 and PC 1440×900, we confirmed with real keys that clearing the month and leaving the field keeps the condition, and that clearing the conditions empties the field. The existing flows also passed again.
