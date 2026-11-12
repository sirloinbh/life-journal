---
name: life-journal-testing
description: Write or update behavior-focused tests with life-journal implementations and fixes, run them before commits and PR creation or updates, and record actual results. Use with life-journal-implementation; for documentation-only changes validate the changed artifacts instead of adding unrelated app tests.
---

# Writing and running tests for the Review and Journal App

Follow the project AGENTS.md and the life-journal-implementation procedure together. This skill sets the standard for writing and running tests. It keeps the issue, branch, docs, and PR steps, and the policy of automated code review after the PR (at most 2 rounds) → merge after CI passes.

## Write tests together with the implementation or fix

- When you implement a feature or change behavior, add or update test code that verifies that requirement, and put the implementation and the tests in the same work commit. Do not let running the existing tests stand in for verifying the new feature.
- For a bug fix, add a regression test that catches the bug if it comes back. Where possible, confirm it fails before the fix and passes after, and if you cannot reproduce it, record that limit.
- For a refactor, verify that existing behavior is preserved. If the related tests are enough, you can keep them as they are, but strengthen the scenarios that fall short.
- Prefer tests that verify results the user can see and domain rules over tests that repeat the internal implementation. Choose the normal path plus the input errors, boundaries, and failure paths that relate to the change.
- Use unit tests for business logic, integration tests for the API, DB storage, and transactions, and component or browser tests for screen input and save flows. Do not add every kind to every change.
- Check the test tools and commands that are installed now. Do not report that you used tools that have not been adopted yet, such as Vitest or Playwright, as if they were installed.
- Keep test data separate from production and user data. Write checks that depend on time, dates, or random values so that they verify the same meaning when the run environment changes.

## Before committing

- Check the changes and tests that will be committed and actually run the related tests. Put the implementation, tests, and docs record in the same commit.
- In the matching issue record in docs/changes, leave the test code paths, the behavior verified, and the commands run with results.
- Do not make a failing test pass by skipping it, deleting it, or weakening an assertion. Fix the failure and then commit.
- If you cannot prepare the environment that is needed, record that you did not run the tests. Do not report unverified implementation as done, and hand over a PR with remaining verification as a draft.

## Before creating or updating a PR

- Run the related tests and the project required checks on the final diff and confirm they pass. If nothing changed after the commit and the result for the same target is still valid, you do not need to repeat the same checks.
- In the PR, record the tests added or changed, the commands run, pass/fail/skip, and the reason for anything not run. Do not count an integration test skipped because the DB environment variable was not set as a pass.
- If you fix code or tests after the PR, re-run the affected checks and update the docs and PR results. Fix CI failures too.
- If only docs, skills, or formatting changed and app behavior did not change, verify with that artifact validator, format check, and link check, and state why you did not add app tests. A behavior change in executable code or a check script includes related tests or an execution check.
- Put the related tests in review-fix commits too, and re-run the related tests on the last commit. Do not merge before all required CI checks on the final head pass. After they pass, follow the life-journal-implementation procedure for the merge.
