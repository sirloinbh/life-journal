# Open on the day log and use the shared menu order (#235)

## Purpose

User requirement of 2026-11-26 (central rule project-standards#1128): the app opens on the day log, and the menu order is day log, Week, 12 weeks, the other pages, Dashboard, Settings.

## Changes

- `/` redirects to the day log (`/journal`, which opens today). The Dashboard moved to `/dashboard`. An unknown address now falls back to `/`.
- The Journal page and menu entry are named "Day log".
- New Week page (`/week/<Sunday>`): each day of the week with its entry and the items completed that day. New 12 weeks page (`/weeks`): the days written in each of the last 12 weeks, each linking to its week. Both read the same records as the day log.
- `GET /api/journal` takes optional `from` and `to` dates (both included) for the two views; the OpenAPI document is updated.
- Menu order: Day log, Week, 12 weeks, Bucket list, Table view, Calendar, Statistics, Study terms, Dashboard, Settings.

## Verification

- `npm run check`: see the PR.
- Tests: `week-dates.test.ts`, `journal-weeks.test.tsx`, menu order and start page in `app.test.tsx`, range filter in `journal.integration.test.ts`.

## Limits

- The 12 weeks page counts written days only; completed items are shown on the Week page.
