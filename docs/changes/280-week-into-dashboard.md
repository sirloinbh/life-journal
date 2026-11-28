# #280 Merge Week and 12 weeks into Dashboard

- Issue: [#280](https://github.com/sirloinbh/life-journal/issues/280) (tracking: sirloinbh/project-standards#1215)

## Changes — 2026-11-28

- The Week and 12 weeks menu items are removed. They are views of the Dashboard at `/dashboard/week/<date>` and `/dashboard/weeks/<date>`, chosen with a "Dashboard view" tab row. `/dashboard` opens the Week view.
- `/week/<date>` and `/weeks/<date>` redirect to the new addresses and keep the date.
- The Dashboard's old placeholder description is gone with the placeholder.
- Tests: `journal-weeks.test.tsx` uses the new addresses and checks both redirects; `app.test.tsx` checks the menu.
