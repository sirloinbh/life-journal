# Next steps

Last updated: **2026-11-23 (Asia/Seoul)**. The run of that day is in the [2026-11-23 daily log](../daily/2026-11-23.md).

## What is left to do

### What the user does first

| Task                                                                | Blocked card  | Note                                                                                                                           |
| ------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Run `npm ci` in the main checkout                                   | -             | #158 added `@tanstack/react-query`; the app does not build or start without it                                                 |
| Apply migration `009` to the existing DB                            | -             | Run `npm run db:migrate` once from the root (`database/README.md`). It names the items CHECK constraints (#145)                |
| Add `AUTH_DISABLED=1` to a local `.env` without `AUTH_INTERNAL_URL` | -             | As in `.env.example` (#141). Without it `npm run dev -w backend` refuses to start unless `NODE_ENV` is `development` or `test` |
| #40 Get YES24, TMDB, and TourAPI keys                               | #42, #43, #45 | Put the values only in `.env`; do not write them in issues, PRs, or chat                                                       |
| #38 Create a Google OAuth client                                    | #39           | Put the values only in `.env`                                                                                                  |
| Apply for a KOPIS key                                               | #44           | Apply when you start #44. It may be cancelled after 3 months of no use                                                         |
| #29 Request AWS resources                                           | #29           | Photos will be stored in S3, so a bucket, credentials, and an SDK install are needed. Not requested yet, so this is on hold    |

### What the agent does

| Order | Task                                        | Condition                                                               |
| ----- | ------------------------------------------- | ----------------------------------------------------------------------- |
| 1     | #42 YES24, #43 TMDB, #45 TourAPI auto-fill  | After #40 is done. Decide the item detail screen or display place first |
| 2     | #44 KOPIS auto-fill                         | After the KOPIS key is requested                                        |
| 3     | #39 Google Calendar integration             | After #38 is done. Ask the confirmation items on the card first         |
| 4     | #29 Store photos in S3                      | After AWS is ready                                                      |
| 5     | #111 Require the shared sign-in (epic #159) | Needs a deploy, then a check on the server                              |
| 6     | #133 Update picomatch                       | When a patched version ships (4.0.7 is still the latest)                |

### To check

- Real touch devices and the calendar popup: the bucket list, the items table ("Load more" and the half-typed date filter), and the terms page were checked only in desktop Chrome at 390×844 and 1440×900.
- Optional: the container health check with a real image.
- Production DB locale: title sorting and non-ASCII case-insensitive search follow this value.

## Execution boundary

Deploys, syncing the sub-repositories, and creating AWS resources are done only on a separate request. Add the ECR repository of the shared infrastructure to the list in `shared-aws-infrastructure` at the first deploy.
