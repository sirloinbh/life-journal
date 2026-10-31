# #22 5개 분야 항목 저장 API

- 이슈: [#22](https://github.com/sirloinbh/life-journal/issues/22)
- 브랜치: `feat/22-items-api`

## 목적

버킷리스트, 평가, 감상문, 표 보기의 바탕이 되는 항목 데이터를 저장·조회·수정·삭제할 수 있게 한다.

## 결정

이슈 댓글에 기록한 사용자 결정을 따른다.

- 버킷리스트와 완료 기록은 한 테이블에 두고 `status`(`wishlist` / `done`)로 나눈다.
- 비용은 원 단위 정수(`cost_krw`)이며 통화는 KRW 하나다.
- 분야별 정보는 `details`(`jsonb`) 한 칸에 두고 분야별 Zod 스키마로 검증한다.
- `done`이면 완료일이 필수이고, 완료일은 오늘(Asia/Seoul)보다 뒤일 수 없다. `wishlist`에는 완료일을 넣을 수 없다. 예정일은 제한이 없다.

구현하면서 정한 값은 다음과 같다. #23 화면 작업에서 바뀔 수 있다.

| 분야 (`category`) | 세부 종류 (`subtype`)                     | 분야별 정보 (`details`, 모두 선택)    |
| ----------------- | ----------------------------------------- | ------------------------------------- |
| `reading`         | 없음                                      | `author`, `publisher`                 |
| `screen`          | `movie`, `drama`                          | `director`, `cast`                    |
| `stage`           | `play`, `performance`, `musical`, `opera` | `venue`, `cast`                       |
| `drink`           | `wine`, `whisky`, `sake`                  | `producer`, `region`, `vintage`(연도) |
| `travel`          | 없음                                      | `country`, `city`                     |

## 변경 — 2026-10-31

- `database/migrations/002_items.sql`: `items` 테이블과 목록 정렬용 인덱스. DB도 분야·상태·비용·제목과 "완료 상태와 완료일은 함께" 규칙을 `CHECK`로 막는다.
- `backend/src/items.ts`: `GET/POST /api/items`, `GET/PATCH/DELETE /api/items/:id`와 검증.
- `PATCH`: 일부 값만 받아 현재 행과 합친 뒤 전체 규칙을 다시 검사한다. 행을 잠그는 트랜잭션 안에서 처리해 동시 수정으로 값이 사라지지 않게 한다. `details`는 합치지 않고 통째로 바꾼다.
- `backend/src/app.ts`: 자체 오류 처리를 중앙 `standard/http.ts`의 `errorHandler`·`notFound`로 바꿨다. 잘못된 JSON 본문이 500이 아니라 한국어 400이 된다. BIGINT `id`는 JSON 숫자로 내려준다.
- 검색·필터·페이지 나누기는 #26 범위라 넣지 않았다.

## 테스트

- `backend/test/items.test.ts`(DB 없음): 잘못된 분야·날짜·비용·세부 종류·분야별 정보, 완료일 규칙, NUL 문자 등 입력이 DB에 닿기 전에 한국어 400으로 거절되는지, 완료일이 오늘이면 받아들이는지 확인한다.
- `backend/test/db.integration.test.ts`(실제 DB): 마이그레이션 재적용, 5개 분야 저장·재조회·목록 순서, 수정·재오픈·분야 변경·삭제·404, DB `CHECK` 동작을 확인한다.
- `backend/test/helpers.ts`: 요청에 메서드와 본문을 넣을 수 있게 했다. `fetch` 대신 `node:http`를 쓴다. 임시 포트 범위가 1024부터인 Windows PC에서 테스트 서버가 `fetch`가 막는 포트를 받아 `bad port`로 실패한 것을 고쳤다.

## 검증 — 2026-10-31

임시 PostgreSQL 17.11(`journal_test`, 마이그레이션 001·002 적용)을 `TEST_DATABASE_URL`로 지정해 Windows에서 실행했다.

- `npm run check`: 통과(포맷, lint, 타입, 테스트, 스킬 동기화 검사, 빌드).
- `npm test`: 백엔드 37개 통과·건너뜀 0개, 프론트엔드 52개 통과.
- `npm run knip`: 통과.
- `TEST_DATABASE_URL` 없이 `npm test -w backend`: 32개 통과, DB 통합 테스트 5개 건너뜀. 건너뛴 결과는 DB 검증으로 치지 않는다.
- 화면 변경이 없어 브라우저 확인은 하지 않았다.

## 1차 리뷰 반영 — 2026-10-31

작성 문맥과 분리한 에이전트 리뷰의 지적과 처리 결과다.

| 지적                                                    | 처리                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PATCH 중 DB 연결이 끊기면 API 프로세스가 죽음           | 트랜잭션 동안 연결의 `error`를 받아 로그로 남긴다. 요청은 500으로 끝나고 프로세스는 살아 있다                                                                      |
| 쉬는 풀 연결이 끊겨도 프로세스가 죽음(기존 `server.ts`) | 이 PR의 변경이 아니라 [#31](https://github.com/sirloinbh/life-journal/issues/31)로 분리                                                                            |
| ROLLBACK 실패가 원래 오류를 덮음                        | 원래 오류를 유지하고 그 연결은 풀에서 버린다                                                                                                                       |
| 잠금·롤백을 검증하는 테스트가 없음                      | 동시 PATCH, COMMIT 실패 시 되돌림, 연결 끊김, PATCH의 미래 완료일 테스트 추가                                                                                      |
| `costKrw: -1.5`에서 같은 오류 메시지가 두 번 나옴       | 비용·빈티지 검사를 묶어 한 번만 나오게 수정                                                                                                                        |
| `CodeQL` 체크 실패(`js/missing-rate-limiting` 5건)      | 사용자 결정으로 오탐 처리 대신 앱에 요청 제한을 넣기로 함. [#32](https://github.com/sirloinbh/life-journal/issues/32)로 분리. 그 병합 전에는 이 PR을 병합하지 않음 |

### 검증

같은 임시 DB로 실행했다.

- `npm run check`: 통과.
- `npm test -w backend`: 44개 통과·건너뜀 0개.
- 코드에서 보호 장치를 하나씩 뺀 뒤 `npm test -w backend`를 돌려 새 테스트가 실패하는지 확인했다. 확인 후 코드는 되돌렸다.
  - `FOR UPDATE` 제거: 동시 PATCH 테스트 실패.
  - 연결 `error` 리스너 제거: 연결 끊김 테스트 실패.
  - `ROLLBACK` 제거: COMMIT 실패 되돌림 테스트와 ROLLBACK 실패 테스트 실패.

## 2차 리뷰 — 2026-10-31

head `62597f1`을 리뷰했다. 코드·테스트·마이그레이션의 보완점은 없었고, 1차 지적이 고쳐진 것을 확인했다. 부하 없이 12회, CPU 부하 중 6회 `npm test -w backend`를 돌려 매번 44개가 통과했다(불안정 없음). PR 본문의 테스트 건수가 오래된 지적 1건은 본문을 고쳐 반영했다. 리뷰는 2회로 끝낸다.
