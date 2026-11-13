# Next steps

Last updated: **2026-11-02 (Asia/Seoul)**.

## What is left to do

### What the user does first

| Task                                  | Blocked card  | Note                                                                                                                        |
| ------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| #40 Get YES24, TMDB, and TourAPI keys | #42, #43, #45 | Put the values only in `.env`; do not write them in issues, PRs, or chat                                                    |
| #38 Create a Google OAuth client      | #39           | Put the values only in `.env`                                                                                               |
| Apply for a KOPIS key                 | #44           | Apply when you start #44. It may be cancelled after 3 months of no use                                                      |
| #29 Request AWS resources             | #29           | Photos will be stored in S3, so a bucket, credentials, and an SDK install are needed. Not requested yet, so this is on hold |

### What the agent does

| Order | Task                                       | Condition                                                               |
| ----- | ------------------------------------------ | ----------------------------------------------------------------------- |
| 1     | #42 YES24, #43 TMDB, #45 TourAPI auto-fill | After #40 is done. Decide the item detail screen or display place first |
| 2     | #44 KOPIS auto-fill                        | After the KOPIS key is requested                                        |
| 3     | #39 Google Calendar integration            | After #38 is done. Ask the confirmation items on the card first         |
| 4     | #29 Store photos in S3                     | After AWS is ready                                                      |
| 5     | Resolve the `minimatch` security alert     | After 2026-11-10. An override that fits ESLint `^10` is needed          |

### To check

- Real touch devices and the calendar popup: the bucket list, table view, and terms study were checked only with headless Chrome.
- Production DB locale: title sorting and non-ASCII case-insensitive search follow this value.
- Existing local DB: run `npm run db:migrate` once from the root. With no record it re-applies from `001` and records them, and it also applies `007`, which has not been applied yet (`database/README.md`).

## Execution boundary

Deploys, syncing the sub-repositories, and creating AWS resources are done only on a separate request. Add the ECR repository of the shared infrastructure to the list in `shared-aws-infrastructure` at the first deploy.
