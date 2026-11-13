# #23 Bucket list screen per area

- Issue: [#23](https://github.com/sirloinbh/life-journal/issues/23)
- Branch: `feat/23-bucket-list`

## Purpose

Make the item API of #22 usable from the screen, so that you can build a bucket list per area and mark items complete.

## Changes — 2026-10-31

- `frontend/src/app.tsx`: added the menu and the address `/bucket-list/:category`. If the area is missing or unknown, it moves to `/bucket-list/reading`.
- `frontend/src/bucket-list.tsx`: 5 area tabs, the item list, the add and edit form, marking complete, cancelling completion, and the delete confirmation.
- `frontend/src/items.ts`: the per-area subtype and input item definitions, and the code that turns form values into a request.
- Each area has its own address for its tab, so the same area opens even after a reload. Items are received at once with `GET /api/items` and split on the screen. Search and filters are in the scope of #26.
- Long area names are shortened in the tabs to "공연" (performances) and "주류" (alcohol), and the description line says "연극·공연·뮤지컬·오페라" (plays, performances, musicals, opera) and "와인·위스키·사케" (wine, whisky, sake).
- Validation is left to the server. A non-numeric cost or vintage is sent as it is, and the Korean message from the server is shown in the form. If saving fails, the form stays open and keeps the input values.
- We added "cancel completion", which is not in the issue, because you need a way to undo a completion mark pressed by mistake. It clears the completion date, so we ask for confirmation first.
- The area cannot be changed in the form, because each area has different subtypes and input items. The API supports changing the area.

## Tests

`frontend/src/bucket-list.test.tsx` (an in-memory fake API):

- For each of the 5 areas, add, edit, mark complete, cancel completion, delete, and the content of the request sent.
- Separation of items per tab, menu navigation, and an unknown area address.
- A server validation error stays in the form in Korean, completion date rejection, and editing the completion date of a completed item.
- Deleting an item that was already deleted, and a list load failure and retry.

## Verification — 2026-10-31

Ran on Windows with a temporary PostgreSQL 17.11 set as `TEST_DATABASE_URL`.

- `npm run check`: pass. Backend 45 passed and 0 skipped, frontend 65 passed.
- `npm run knip`: pass.

### Browser check

We started the real API, Vite, and a temporary DB and drove headless Chrome 156 through the DevTools protocol. We did not use the user's Chrome profile. The Claude in Chrome extension was not connected, so we could not use it.

We ran the same flow at mobile 390×844 (mobile emulation without touch) and PC 1440×900, and everything passed.

- `/bucket-list` opens on the first area, and none of the 5 tabs overflows the page horizontally.
- In the performance area, an empty title, a missing subtype, a non-numeric cost, and a future completion date are shown with the real server Korean messages.
- Adding, keeping after a reload, editing, marking complete, cancelling completion, and deleting all work.
- The console had only the 400 response records that we triggered on purpose in the checks above, and no other errors or exceptions.
- We looked at the screenshots of the list, the form errors, and the completion screen. Nothing was broken. They were temporary files, so we did not put them in the repository.

In the real browser we ran only the performance area through to the end. The full flows of the other 4 areas were checked with the screen tests.

## First review applied — 2026-10-31

A separate agent reviewed head `52ae273`. We applied all 12 findings (0 blocking the merge, 4 to fix, 8 minor) in this commit.

| Finding                                                              | Handling                                                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Esc or close during saving closed the form and lost the result       | The form does not close until saving finishes                                                                  |
| A re-fetch failure after a successful save looked like a failure     | Keep the list and show "저장했습니다. 목록은 새로 불러오지 못했습니다" (Saved. The list could not be reloaded) |
| Closing a dialog lost keyboard focus                                 | Return to the button that opened it. If that button is gone, go to the add item button                         |
| A long title with no spaces pushed the card and dialog out           | Wrap with `wrap-anywhere`                                                                                      |
| The dialog content changed while it was closing                      | Keep the last content while closing                                                                            |
| `15.000`, `1e3`, and `1,5` were saved as numbers                     | Convert only integers and correct comma notation to numbers, and the server rejects the rest                   |
| "다시 시도" (Retry) had no progress indicator or race protection     | Disabled while in progress, and only the result of the latest request is applied                               |
| The list stayed the same even when the form got a 404                | On 404, reload the list                                                                                        |
| The card title was h3 after h1                                       | Changed to h2                                                                                                  |
| The default completion date was fixed to the date the app was opened | Computed in Asia/Seoul when the form opens                                                                     |
| No test for vintage number conversion                                | Added a test that sends every input item of alcohol                                                            |
| The test names and the record were broader than reality              | Split into a main menu click test and an invalid address test                                                  |

The remaining limits are as follows.

- When deleting or cancelling completion succeeds, the button to return focus to is gone, so focus goes back to the body. Closing with cancel returns to the button.
- If you switch tabs with browser back during a save, you cannot see the failure message of that save. The list is reloaded.

### Verification

- `npm run check`: pass. Backend 45 passed and 0 skipped, frontend 79 passed.
- `npm run knip`: pass.
- We ran the existing flow again in headless Chrome 156 at mobile 390×844 and PC 1440×900, and it passed. The console had only the 400 response records that we triggered on purpose.
- We also checked the following in the same environment.
  - A 200-character title: no horizontal overflow in the page or in the edit, complete, and delete dialogs.
  - Closing with Esc returns focus to the button that opened it.
  - Pressing Esc while a save request is held does not close the form, and it closes when the save finishes.

## Second review applied — 2026-10-31

A separate agent reviewed head `cad6285`. We applied all 3 findings (1 blocking the merge, 1 to fix, 1 minor). As the rule says, there is no third review.

| Finding                                                                     | Handling                                                                                                                                                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Double-clicking save or pressing Enter twice created a duplicate item       | A regression from the first-round fix. Disable the button while the form is closing too                                                                                                                             |
| Fixing with a stale list after a re-fetch failure overwrote the saved value | Reflect the server response in the list right away. Even if the re-fetch fails, my change shows correctly, so we removed the first-round message "목록은 새로 불러오지 못했습니다" (the list could not be reloaded) |
| No test for applying only the latest request                                | Added a test for an old response that arrives late                                                                                                                                                                  |

Remaining limit: a second input after the form has fully closed (after about 200ms) reaches the element in that place. With a mouse you can press the button of the card below, but deleting goes through a confirmation dialog.

### Verification

- `npm run check`: pass. Backend 45 passed and 0 skipped, frontend 80 passed.
- `npm run knip`: pass.
- We ran `bucket-list.test.tsx` with the `request === latest.current` condition removed from the code, confirmed that the late response test fails, and reverted the code.
- We ran the whole flow again in headless Chrome 156 at mobile 390×844 and PC 1440×900, and it passed. The console had only the 400 response records that we triggered on purpose.
- In the same environment we ran a save double-click and a double Enter at 20, 60, 120, and 180 ms intervals, and confirmed on a real DB that only 1 item was saved each time. jsdom has no closing animation, so this regression cannot be caught with a screen test.
