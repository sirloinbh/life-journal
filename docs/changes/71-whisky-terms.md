# #71 Fill in the whisky terms for terms study

- Issue: [#71](https://github.com/sirloinbh/life-journal/issues/71)
- Branch: `feat/71-whisky-terms`

## Changes — 2026-11-03

Added 48 terms to the whisky area of terms study, making 50 in total. We confirmed the number with the user when starting (50, the same as wine).

- Split them into four scopes and added a comment per scope in `backend/src/terms-data.ts`. On screen they appear in data order. The term names below are the Korean data as stored.
  - Types (12): 싱글 몰트(existing), 블렌디드 몰트, 블렌디드 위스키, 그레인위스키, 싱글 그레인, 버번, 테네시 위스키, 라이 위스키, 싱글 팟 스틸, 싱글 캐스크, 스몰 배치, 보틀드 인 본드
  - Regions (12): 스카치위스키, 스페이사이드, 하일랜드, 아일라, 로랜드, 캠벨타운, 아일랜즈, 아이리시위스키, 켄터키, 재패니즈위스키, 캐나디언위스키, 월드 위스키
  - Distilling and aging (13): 몰팅, 당화, 워시, 단식 증류기, 연속식 증류기, 뉴 메이크, 엔젤스 셰어, 버번 캐스크, 셰리 캐스크, 캐스크 피니시, 숙성 연수 표기, 냉각 여과, 캐스크 스트렝스(existing)
  - Tasting words and how to drink (13): 노즈, 팔레트, 피니시, 피티, 스모키, 셰리 풍미, 마우스필, 니트, 온 더 록, 하이볼, 가수, 알코올 도수, 프루프
- Kept the IDs and content of the existing terms `whisky-single-malt` and `whisky-cask-strength` as they are, because the memorized marks point to these IDs. We did not change the existing order and put the new terms between them, so cask strength comes at the end of the distilling and aging scope.
- The method of maturing a little longer in another cask after aging is named "cask finish" so that it is not confused with the tasting "finish".
- The DB schema and the API do not change.

## Source

The meanings are sentences written directly for this app. We did not copy them from a particular glossary or book; we wrote them from widely known whisky knowledge (the raw material standard of each type, regions, and the distilling and aging process). There is no separate source. If you find an explanation that is wrong, fix this file and the data together.

## Tests

- `backend/test/terms.test.ts`: changed the wine-only test of #70 into a per-area table (`FILLED_DOMAINS`). For each area it checks the number of terms, the representative term of each scope, and the existing IDs that memorized marks point to. We added whisky to this table, and #72 and #73 only need one more line. It also checks that `GET /api/terms` sends the number of terms of the filled areas and the memorized marks.
- The scope check only looks at whether the one representative term chosen for each scope exists, because the data has no scope field.
- That the terms show when you pick an area on screen is checked by the "a domain shows only its own terms" test in `frontend/src/terms-study.test.tsx`. This test uses fake API data. The new data is checked with the backend tests, and the screen behavior with fake data.

## Verification

- `npm run check`: pass (backend 131 passed, 0 skipped, frontend 144 passed, 2 skipped, skills 4 passed).
- We did not check in a browser. The screen code did not change, and we checked the number of data items and the API response with tests.

## Review

We applied 6 of the 7 findings of the first round.

- Meaning fixes (the Korean meaning text): the aging criterion of bottled-in-bond, Scotch whisky, Irish whisky, and Canadian whisky changed from "more than" to "at least" (the legal standard is a minimum period). Also single cask (why the number of bottles is small), pot still ("one cask at a time" could be read as the aging cask), new make (the aging criterion differs by country), and blended malt (the description of grain whisky).
- Fixed the description of the position of cask strength in this document to match the real diff.
- Not applied: the optional suggestion to change the screen test to whisky data. The screen behavior is the same regardless of the area, and the tests section already states the limit that the new data is checked by the backend tests.
- After applying the first review, `npm run check`: pass (backend 131 passed, 0 skipped, frontend 144 passed, 2 skipped, skills 4 passed).

Second review: all 6 first-round findings were applied. We applied 1 minor finding. In the blended malt description, the Korean text that described grain whisky as "made from grains other than malted barley" was fixed. Grain whisky also contains some malted barley, so it was changed to "made by adding other grains such as wheat or corn to malted barley". Reviews are at most 2, so we do not get another one.

After applying the second review, `npm run check`: pass (backend 131 passed, 0 skipped, frontend 144 passed, 2 skipped, skills 4 passed).
