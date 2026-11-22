# #154 Make terms and items table tests check real behavior

- Issue: [#154](https://github.com/sirloinbh/life-journal/issues/154)
- Branch: `test/154-real-behavior-tests`
- Built on `origin/main` after #150 (PR #191) and #153 (PR #194) merged.

## Purpose

Three screen tests gave false confidence. The stale-list test in `terms-study.test.tsx` flushed one microtask after releasing the held list, while applying it takes several, so its checks could pass whether or not the stale answer was ignored. The half-typed date test in `items-table.test.tsx` redefined `validity` and `value` with `Object.defineProperty`, tying it to how the component reads the field. `bucket-list.test.tsx` was about 800 lines with helpers no other test could reuse.

## Changes

- `terms-study.test.tsx`: the fake API counts the lists it answers and sets `heldListRead` once the screen has read the body of a held list. The test waits for the newer list (third request, Tannin gone) before releasing the held one, then waits until the held body was read and one more task has run, and only then checks that the mark and the count stayed.
- `frontend/src/filter-field.ts` (new): `typedCondition` (the condition a field asks for, or null for a half-typed date) and `needsReset` (whether the field must be set to the condition). `items-table.tsx` uses them; its behavior is unchanged.
- `frontend/src/filter-field.test.ts` (new): the helpers with a value and `badInput` as a browser reports them. `items-table.test.tsx` drops the `Object.defineProperty` test and instead clears the conditions after typing a date that was not applied, which jsdom can drive.
- `frontend/src/test/app.tsx`, `dialog.ts`, `items-api.ts` (new): `json`, `openAt`, `gate`, `allowSelect`, the dialog helpers, `itemRow` and `fakeItemsApi`, moved out of `bucket-list.test.tsx` (now about 690 lines). `items-table.test.tsx` and `terms-study.test.tsx` use the shared `json`, `openAt`, `allowSelect` and `itemRow` instead of their own copies.

## Verification

- `npm run test -w frontend`: 45 files, 297 passed, 3 skipped.
- Checked once by hand: with the stale-response guard in `terms-study.tsx` removed (`request === latest.current` replaced by an always-true check), the new stale-list test fails. (The old test also failed in this run, but only because of timing that the issue showed it could not rely on.)
- Browser: Vite on 5204 with `/api/items` stubbed by Playwright, Chrome at mobile 390×844 and PC 1440×900, `/table?to=2026-03-28&status=done`: one Backspace in Period end leaves a half-typed date (`value` '', `badInput` true); Enter and leaving the field keep `?to=2026-03-28&status=done` and send no new list request; Clear filters empties the field (`badInput` false) and the address. No horizontal overflow, 0 page errors.
- `npm run check`: see the PR body.
