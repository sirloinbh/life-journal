# #41 항목에 참고 링크 저장하기

- 이슈: [#41](https://github.com/sirloinbh/life-journal/issues/41)
- 브랜치: `feat/41-item-link`

## 목적

주류 분야는 공식 API가 없어 수동 입력 + 링크로 정했다(#24). 사용자가 붙여넣은 참고 링크를 저장하고 눌러서 연다.

## 결정

사용자가 이슈 댓글에서 모든 분야에 링크 칸을 넣기로 정했다. 도수 같은 주류 입력 항목은 추가하지 않는다.

구현하면서 정한 값은 다음과 같다.

- `http`, `https` 주소만 받는다. `javascript:` 같은 주소가 화면의 `href`에 들어가지 않게 하기 위해서다.
- 2000자까지 받는다. 비우면 링크를 지운다.
- 완료를 취소해도 링크는 남는다. 완료 기록이 아니라 항목의 참고 정보이기 때문이다.
- 서버는 링크 주소로 요청을 보내지 않는다.

## 변경 — 2026-10-31

- `database/migrations/005_item_link.sql`: `link` 컬럼. DB도 길이와 `http`, `https` 시작을 `CHECK`로 막는다.
- `backend/src/items.ts`: 링크 검증, 저장·수정.
- `frontend/src/bucket-list.tsx`, `frontend/src/items.ts`: 추가·수정 폼의 링크 칸, 카드의 "링크 열기"(새 탭, `noopener noreferrer`).

## 테스트

- `backend/test/items.test.ts`: `javascript:`, `data:`, `ftp:`, 주소가 아닌 값, 2001자가 한국어 400으로 거절된다. 저장할 때 `fetch`를 부르지 않는다.
- `backend/test/db.integration.test.ts`: 마이그레이션 재적용과 행이 있는 테이블 적용, 저장·유지·수정·삭제, DB `CHECK`.
- `frontend/src/bucket-list.test.tsx`: 저장, 새 탭 링크, 지우기, 거절 메시지.

## 다음 작업 문서

사용자 요청으로 남은 카드를 `docs/next-steps/README.md`에 내일 할 일로 정리했다.

## 검증 — 2026-10-31

임시 PostgreSQL 17.11을 `TEST_DATABASE_URL`로 지정해 Windows에서 실행했다.

- `npm run check`: 통과. 백엔드 114개 통과·건너뜀 0개, 프론트엔드 125개 통과·2개 건너뜀(다크 전용 앱 조건).
- `npm run knip`: 통과.
- 브라우저: 헤드리스 Chrome 156, 모바일 390×844(터치 없는 에뮬레이션)와 PC 1440×900. `javascript:` 링크의 한국어 오류, 카드의 링크 주소와 새 탭 속성을 확인했다. 기존 흐름도 다시 통과했다. 콘솔에는 일부러 일으킨 400 응답 기록만 있었다.

## 리뷰 — 2026-10-31

head `4f86841`을 분리된 에이전트가 리뷰했다. 보완점이 없어 2차 리뷰는 하지 않는다. 리뷰어가 실제 라우터와 테스트 DB에 약 65개 입력을 보내 500 응답과 위험한 `href` 경로가 없는 것을 확인했다.
