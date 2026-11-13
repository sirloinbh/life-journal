# #70 Fill in the wine terms for terms study

- Issue: [#70](https://github.com/sirloinbh/life-journal/issues/70)
- Branch: `feat/70-wine-terms`

## Changes — 2026-11-03

Added 48 terms to the wine area of terms study, making 50 in total. We confirmed the number with the user when starting (50).

- Split them into four scopes and added a comment per scope in `backend/src/terms-data.ts`. On screen they appear in data order. The term names below are the Korean data as stored.
  - Varieties (12): 카베르네 소비뇽, 메를로, 피노 누아, 시라, 그르나슈, 산지오베제, 네비올로, 템프라니요, 말벡, 샤르도네, 소비뇽 블랑, 리슬링
  - Regions (13): 테루아(existing), 보르도, 부르고뉴, 샹파뉴, 론, 토스카나, 피에몬테, 리오하, 모젤, 나파 밸리, 원산지 명칭, 구대륙, 신대륙
  - Winemaking (12): 빈티지, 블렌딩, 알코올 발효, 젖산 발효, 침용, 오크 숙성, 쉬르 리, 전통 방식, 귀부, 주정 강화 와인, 내추럴 와인, 아황산염
  - Tasting words (13): 타닌(existing), 바디, 산도, 드라이, 여운, 아로마, 부케, 균형, 미네랄리티, 레그, 스월링, 디캔팅, 부쇼네
- Kept the IDs and content of the existing terms `wine-tannin` and `wine-terroir` as they are, because the memorized marks point to these IDs. Only the order was moved to fit the scopes.
- The DB schema and the API do not change.

## Source

The meanings are sentences written directly for this app. We did not copy them from a particular glossary or book; we wrote them from widely known wine knowledge (grape characteristics, regions, and the winemaking process). There is no separate source. If you find an explanation that is wrong, fix this file and the data together.

## Tests

- `backend/test/terms.test.ts`: checks that there are 50 wine terms and that each scope has a representative term, and that `GET /api/terms` sends the 50 wine terms together with the memorized marks. The existing tests check the ID format, duplicate names, and blanks.
- That the terms show when you pick the wine area on screen is already checked by the "a domain shows only its own terms" test in `frontend/src/terms-study.test.tsx`. This test uses fake API data (tannin, terroir). The new data is checked with the backend tests, and the screen behavior with fake data.
- The scope check only looks at whether the one representative term chosen for each scope exists, because the data has no scope field.

## Verification

- `npm run check`: pass (backend 128 passed, 0 skipped, frontend 144 passed, 2 skipped, skills 4 passed).
- After applying the first review, `npm run check`: pass (backend 129 passed, 0 skipped, frontend 144 passed, 2 skipped, skills 4 passed).
- We did not check in a browser. The screen code did not change, and we checked the number of data items and the API response with tests.

## Review

We applied the 9 findings of the first round.

- Meaning fixes (the Korean meaning text): sulfites (explain the labeling reason by the legal standard), natural wine (there is no common legal standard), Burgundy (red and white each from one grape variety), dry (the opposite of sweet), malolactic fermentation (what lactic acid bacteria do, kept apart from the second fermentation in the bottle), appellation (the region where the grapes were grown; the varieties and methods are a European system), and sur lie (flavor "can" develop).
- Tests: the scope-check test name and comment now state that it only looks at the representative term. We added a unit test that `wine-tannin` and `wine-terroir`, which the memorized marks point to, still exist.
- Wrote in the tests section of this document that the screen test uses fake data.

Second review: all first-round findings were applied and there was nothing to fix.
