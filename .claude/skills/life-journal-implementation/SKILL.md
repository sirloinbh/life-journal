---
name: life-journal-implementation
description: Follow the user's issue, numbered branch, implementation with docs, tests, and PR workflow for changes to the sirloinbh life-journal project. Use for code, configuration, documentation, and skill edits; exclude read-only questions and recommendations. Review each PR at most twice with fix commits, split large fixes into new issues, then merge with a merge commit once all required CI checks pass.
---

# Review and Journal App implementation procedure

This skill applies to changes in `sirloinbh/life-journal`. Do not apply this account, repository, or policy to other projects. Read the project root `AGENTS.md` and the related docs first. Follow the order below: pass automated code review (at most 2 rounds), and finish by merging a PR whose required CI has passed.

## 1. Register an issue card

- Check the GitHub remote URL and `gh api user --jq .login`. The expected account is `sirloinbh`. If it is another account, do not make remote changes until authentication is fixed.
- Reuse the issue the user named, or an issue already registered for the same request. Check existing results before a retry so you do not create duplicate issues.
- In a new issue, write the problem and purpose, the requested scope, the done criteria, and the verification method. In this project an issue card means a GitHub Issue. Do not create or link a Projects board unless one was specified.
- Write the body to a UTF-8 temporary file and register it with `gh issue create --repo sirloinbh/life-journal --title ... --body-file ...`. Do not put tokens or secrets in the body.
- Keep the real issue number and URL that were issued. If registering the issue fails, do not invent a number or start the code change first.

## 2. Create a branch from the issue number

- Check the working tree and the current branch. If there are changes from other work, keep them and avoid mixing work.
- The default target branch is `main`. Do not start new work from an unrelated unmerged work branch. In a clean working tree, fetch the remote main and branch from it. If there are user changes, prepare a workspace that can preserve them.
- Branch name: `<type>/<number>-<short-slug>`. Examples: `feat/12-first-feature`, `fix/13-goal-date`, `docs/14-project-skills`, `chore/15-ci`.
- If a branch for the same issue already exists, check its state and continue on it.
- Make changes and commits on this branch. Do not commit or push directly to `main`.

## 3. Implement and record docs for each commit

- When you implement or fix something, read the project `skills/life-journal-testing/SKILL.md` and write or update the related tests together. A bug fix adds a regression test. Implementation, tests, and docs go in the same work commit, and you run the related tests before committing.
- Implement only the requested scope. For development foundation work, also read `life-journal-foundation`.
- Create `docs/changes/<number>-<slug>.md` and record the issue link, purpose, changes, verification, and limits or follow-up work.
- **In each work commit, record in the docs the change and verification done in that commit.** You may accumulate entries in one issue document. A commit that changes only docs also updates the matching work record.
- Record why the change was made and what was observed. Do not write that a check or deploy was done when it was not. You do not need to make up a SHA that points to the commit itself. Tell entries apart by commit title or unit of work.
- A commit title includes the type and the issue number, as in `feat: ... (#12)`, `fix: ... (#13)`, `docs: ... (#14)`.
- Before staging, check the diff and whether it contains secrets, and stage only the related files by name. Do not include changes made by other users.

## 4. Open a PR after testing

- Before you create or update a PR, run the related tests and required checks on the final change. Leave the added or changed test code, the behavior verified, the commands actually run, and pass/fail/skip in the docs and the PR. For the required commands and the DB integration test conditions, follow the project `AGENTS.md`. Do not add unnecessary app tests for a plain docs or skill change.
- Fix failures, and separate checks that could not run, DB tests that were skipped, and unfinished browser verification in the docs and the PR. If required verification is blocked, make the PR a draft.
- Push only the work branch. The PR target is `main` of `sirloinbh/life-journal`. The subtree sync script pushes main and the sub-repositories, so do not use it at this step.
- If a PR for the same head branch exists, update it and do not create a duplicate.
- Pass the PR body as a UTF-8 file. Include the problem and the behavior after the change, the main changes, the checks actually run with results, evidence where possible for screen changes, and `Closes #<number>`. If there are no images, say why and state the verification limits.
- Check the GitHub Actions results and fix related failures. Say so if a check is still running. If you changed code after creating the PR, re-run the affected checks and update the docs and PR results.

## 5. Automated code review after the PR (at most 2 rounds)

After you open a PR, it goes through automated code review at most 2 times. If a review finds something to fix, apply it in an extra commit, and get one more review after the first round of fixes. Do not review again after the second round of fixes. If a review finds nothing, go straight to the next step. A fix that is too large for this PR becomes a new issue card.

1. **First review**: After opening the PR, run a read-only review that is separate from the authoring context (a separate agent, a review tool, and so on). Check correctness, regressions, security, missing tests, and the docs record against the issue done criteria and the full PR diff.
2. **If nothing needs fixing**, end the review and move on to the CI check and the merge.
3. **If something needs fixing**, apply only the findings that can be fixed within this PR. Make an extra commit that includes the related tests and docs record, and push it.
4. **Second review**: Check that the first-round findings were applied and review the added diff. Also look at the full final PR diff. If nothing needs fixing, move on to CI.
5. **Second-round fixes**: Apply second-round findings in an extra commit. Reviews are at most 2, so do not run a third review; move on to CI.
6. **Split large fixes**: Do not fix findings of the following kinds in this PR. Instead create a new issue card (with the problem, scope, and done criteria) in `sirloinbh/life-journal`. Leave the issue link in a PR comment and the docs record, and continue with this PR.
   - A feature outside the requested scope
   - A design or data structure change
   - A change across several modules
   - Work that needs separate verification
7. **Hold the merge**: If either of the following defects remains, do not merge and tell the user.
   - A defect that would break main if split out
   - A defect with a security or data corruption risk
8. **Record**: Leave the result of each review round in a PR comment and the docs work record. Write the findings, the commits that applied them, the issues split out, and whether nothing needed fixing.
9. **Merge after CI**: Re-run the related tests on the last commit. When all required CI checks on the final head pass, merge with that SHA (section 6). If a new commit appears during the review, do not merge on the earlier CI result.

## 6. Merge after CI passes

- After the automated code review (section 5), when all required CI checks on the final head pass, the agent (the main agent or a local worker) merges without asking the user. Right before merging, check the PR head SHA and create a merge commit with `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/gh-project.ps1 pr merge <url> --merge --match-head-commit <confirmed head SHA>`.
- After merging, check that the linked issue (`Closes #<number>`) was closed. If it was not, find the cause and report it.
- Merge stacked PRs in order. When the earlier PR merges, merge `origin/main` into the next PR branch, resolve conflicts, re-run the related tests, push normally (no force push), wait for CI to pass, and merge. Repeat to the end of the stack.
- **Do not merge if any check failed or is still running. Do not bypass branch protection (for example with `--admin`), approve your own PR as a substitute for review, commit or push directly to `main`, or force push.** If you cannot fix CI, leave the PR open and say why.
- In this project a merge to `main` does not trigger a deploy. If deploy automation is added, write it in this document and check the deploy result after merging.
- Report the issue URL, branch name, PR URL, verification and CI results, the merge commit SHA, and the remaining work.

## Authentication and failure handling

Do not re-check issue, push, and PR permissions that were already granted. Respect the execution permissions and GitHub authentication that the tools require. On failure, resume from the step you finished, and if the result of a remote creation is unclear, query it before retrying. Do not work around an account or authentication problem by creating things with a different account.
