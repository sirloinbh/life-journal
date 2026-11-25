# #218 Add a quiz mode to the terms study

- Issue: [#218](https://github.com/sirloinbh/life-journal/issues/218)
- Branch: `feat/218-terms-quiz`

## Purpose

The terms page only listed terms and let me mark them as learned. There was no way to test myself, so the page gets a quiz: it shows a meaning and asks for the term, mostly from terms not marked as learned.

## Changes

- `frontend/src/terms-study-pick.ts` (new): `pickQuestion` picks one question from a domain's terms. The answer comes from the unlearned terms while there are any, and from all terms once every term is learned. The last answer is not asked again right away when another term can be. The choices are the answer and up to three other terms of the same domain, each name offered once (two terms with the same name could not be told apart), in random order. With fewer than two distinct names there is no question. The random source can be passed in for tests.
- `frontend/src/terms-study-quiz.tsx` (new): the quiz card. It shows the meaning and the choices as buttons. After an answer the choices stay focusable (`aria-disabled`, full opacity), the answer gets a green border and a check icon, a wrong pick a red border and a cross, and their names say "(answer)" or "(your pick)" for screen readers. A `role="status"` line says "Right: X." or "Not quite. The answer is X.". Then "Mark X as learned" sends the same request as the list checkbox; after the mark it stays in place as "X is learned" (`aria-disabled`) so the focus is not lost. "Skip" / "Next question" picks a new question, and a counter shows the right answers in this visit. A question keeps term ids, so a learned mark does not change it. Results are not stored.
- `frontend/src/terms-study.tsx`: a "Study mode" segmented control (List / Quiz) under the domain tabs. The mode stays while moving between domains; each domain starts its own quiz. Marks from the quiz go through the same `changeLearned` as the list, so errors, 404 handling, and the cache update are shared.
- Tests: `frontend/src/terms-study-pick.test.ts` (new, 7 tests with a seeded random source) and 5 new screen tests in `frontend/src/terms-study.test.tsx`.

## Verification

- `npm run test -w frontend -- src/terms-study`: 35 passed (2 files). Unit tests: the answer is always unlearned while there are any; with all learned, all 10 terms come up as answers; 4 distinct choices that include the answer, in every position; no immediate repeat; same-name terms offered once; small domains. Screen tests: a wrong answer, marking the term as learned from the quiz (PUT sent, focus kept, list shows it checked), a right answer and the next question, a failed mark, the mode staying on another domain, and a one-term domain.
- Browser: Vite on a temporary port with `/api/terms` stubbed by Playwright with the real 300 terms from `terms-data.ts`, Chrome at mobile 390×844 and PC 1440×900. In the Wine and Opera quizzes: 4 choices, Tab from the mode control reaches the first choice, Enter answers it, the status line reads the result, the focus stays on the picked choice, "Mark … as learned" by keyboard turns into "… is learned" with the focus kept, "Next question" clears the result, no horizontal overflow. The first pass showed the answered choices faded by the disabled style, so they now keep full opacity and only the other choices are muted. The only console errors were 403s for font files that Vite refused to serve from the main checkout's `node_modules` (outside this worktree), unrelated to this change.
- `npm run check`: see the PR body.

## Limits

- The real API with a database was not started for the browser check; the stub served the same data the API returns.

## Check result

- `npm run check` (2026-11-26, before the first push): pass. Format, lint, contract, typecheck pass; backend `node --test` 192 tests, 161 pass, 0 fail, 31 skipped (DB tests without `TEST_DATABASE_URL`; this change has no backend code); frontend Vitest 47 files, 332 passed, 3 skipped; skills tests 4 pass; build passes.
