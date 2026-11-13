# #72 Fill in the literature terms for terms study

- Issue: [#72](https://github.com/sirloinbh/life-journal/issues/72)
- Branch: `feat/72-literature-terms`

## Changes — 2026-11-03

Added 48 terms to the literature area of terms study, making 50 in total. We confirmed the number with the user when starting (50, the same as wine and whisky).

- Split them into four scopes and added a comment per scope in `backend/src/terms-data.ts`. On screen they appear in data order. The term names below are the Korean data as stored.
  - Genres (12): 서사시, 서정시, 산문시, 단편소설, 중편소설, 희곡, 수필, 비극, 희극, 성장소설, 디스토피아 소설, 마술적 사실주의
  - Narrative techniques (13): 시점(existing), 서술자, 1인칭 주인공 시점, 1인칭 관찰자 시점, 3인칭 관찰자 시점, 전지적 작가 시점, 믿을 수 없는 서술자, 의식의 흐름, 내적 독백, 자유 간접 화법, 보여 주기와 말하기, 서간체, 어조
  - Structure (13): 플롯, 발단, 갈등, 절정, 대단원, 복선(existing), 회상, 액자식 구성, 인 메디아스 레스, 피카레스크식 구성, 열린 결말, 주동 인물, 반동 인물
  - Rhetorical devices (12): 직유법, 은유법, 의인법, 상징, 반어법, 역설법, 과장법, 대구법, 반복법, 도치법, 설의법, 인유법
- Kept the IDs and content of the existing terms `literature-foreshadowing` and `literature-point-of-view` as they are, because the memorized marks point to these IDs. In the existing data foreshadowing came before point of view; when grouping by scope, we moved point of view to the start of narrative techniques and foreshadowing into the middle of structure.
- Scope boundaries: symbol is not listed separately in the rhetoric classification used in Korean language education (making comparisons, emphasizing, and varying) and is treated alongside figures of comparison, but it is a way of expression, so we put it in the rhetorical devices scope too. Protagonist and antagonist are character types, but we put them in the structure scope because they count as a story element of the three elements of a novel (characters, events, setting).
- We did not add example passages, so that no lines from real works are copied.
- The DB schema and the API do not change.

## Source

The meanings are sentences written directly for this app. We did not copy them from a particular glossary, textbook, or book; we wrote them from widely known literary concepts (including the point of view, plot stage, and rhetoric classifications used in Korean language education). There is no separate source. If you find an explanation that is wrong, fix this file and the data together.

## Tests

- `backend/test/terms.test.ts`: added literature to the per-area table `FILLED_DOMAINS`. It checks the 50 terms, the representative term of each scope (short story, omniscient narrator point of view, climax, metaphor), and the two existing IDs, and also checks that `GET /api/terms` sends the 50 literature terms.
- The scope check only looks at whether the one representative term chosen for each scope exists, because the data has no scope field.
- That the terms show when you pick an area on screen is checked by the "a domain shows only its own terms" test in `frontend/src/terms-study.test.tsx`. This test uses fake API data. The new data is checked with the backend tests, and the screen behavior with fake data.

## Verification

- `npm run check`: pass (backend 133 passed, 0 skipped, frontend 144 passed, 2 skipped, skills 4 passed).
- We did not check in a browser. The screen code did not change, and we checked the number of data items and the API response with tests.
- Only #73 remains in `docs/next-steps/README.md`, so the cells got wider and Prettier realigned the whole table. Only that one line changed in content.

## Review

We applied all 4 findings of the first round.

- Plot: "not in the order that things happened" could be read as excluding structures that follow time order, so the Korean meaning text was changed to "linked by cause and effect, not only by time order".
- Magical realism: it is in the genre scope but its meaning ended in "technique", so the Korean meaning text was changed to "a trend in fiction".
- Symbol, and protagonist and antagonist: wrote the reason for putting them in their scope in the changes section.

After applying the first review, `npm run check`: pass (backend 133 passed, 0 skipped, frontend 144 passed, 2 skipped, skills 4 passed).

Second review: all first-round findings were applied and there was nothing to fix.
