# #59 Move the backend validation code to zod 4 syntax

- Issue: [#59](https://github.com/sirloinbh/life-journal/issues/59)
- Branch: `chore/59-zod4-syntax`

## Purpose

This is step 1 of central `sirloinbh/project-standards#386`. We move the code first so that this app does not break when the central repository raises `zod` to 4.6.7. The Dependabot alert for security advisory GHSA-mrhx-c7xc-m3w5 is closed by that sync. This PR alone does not close it.

## Changes — 2026-11-01

- `backend/src/items.ts` imports from `zod/v4`. The installed 3.25.76 already contains this path, so the installation was not changed.
- Moved `required_error`, `invalid_type_error`, and `errorMap` to `error`. Moved `.strict()` with a message to `strictObject`.
- Removed the defaults from the PATCH schema. zod 4 applies the default in `.default().optional()`, so if they were left, `status`, `details`, and `subRatings` that PATCH did not send would be overwritten.

## Responses that change

Before the switch, we sent the same 15,323 requests to 3.25.76, to `zod/v4` of 3.25.76, and to `zod/v4` of 4.6.7, and compared them. No input that used to be rejected passed. The difference where a length error message was added to a type error was fixed with `.refine`.

One difference remains with 4.6.7.

- If `costKrw` is `1e400`, only the at-least-0 message appears. Before, the upper limit message appeared with it. This is because zod 4 rejects `Infinity` at the type stage.

After this PR is merged and until 4.6.7 arrives through the central sync, there are more differences only on 3.25.76.

- If `details` or `subRatings` has a `constructor` key, a format error message appears.
- If the value of that key is `null`, the result is 500 instead of 400, because zod `isPlainObject` throws a `TypeError` during parsing. It happens before reaching the DB, so stored values and connections are not affected and the process does not die. It is not input the screen sends and it disappears in 4.6.7, so we did not block it in code.

## Verification

- `npm run check`: pass (backend 116 passed, frontend 125 passed, 2 skipped). Includes the real DB integration tests.
- The comparison above was run at HEAD after the `.refine` fix, and the DB is a fake pool. Real storage was checked with the integration tests above.
- 4.6.7 was tried with the copy that knip installs along with it. That this app runs on 4.6.7 is checked in the CI of the central sync PR.
