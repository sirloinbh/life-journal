# #282 Adopt the shared design-system helpers

Part of sirloinbh/project-standards#1177.

## Change

| Local copy (removed or reduced)                                    | Shared piece now used                                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `serviceToday`, `formatDate` in `items.ts`                         | `serviceToday`, `formatDate` from `lib/format`                                            |
| `addDays`, `weekStart`, `weekDays`, `lastWeeks` in `week-dates.ts` | `components/period-nav/periods` (`isDate` stays)                                          |
| link and blob code in `backup-download.ts`                         | `downloadBlob`                                                                            |
| own banner in `load-failed.tsx`                                    | kit `LoadFailed` and `RetryButton` (the file stays as a thin wrapper for promise reloads) |

## Not changed

- `ScoreField` (a form-bound select, not the kit's radio rating), `Markdown` (different props), tables and empty states are left for a separate card.

## Visible differences

- Dates read "Oct 22, 2026" (the kit's medium style) instead of "October 22, 2026".
- While a retry runs the button is `aria-disabled` (stays focusable) instead of `disabled`.

## Verification

See the PR.
