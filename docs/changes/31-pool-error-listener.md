# #31 DB 연결이 끊겨도 API 프로세스 유지

- 이슈: [#31](https://github.com/sirloinbh/life-journal/issues/31)
- 브랜치: `fix/31-pool-error-listener`

## 목적

쉬고 있는 풀 연결이 끊기면 처리되지 않은 예외로 API 프로세스가 끝나고, 처리 중이던 다른 요청까지 끊겼다. PR #30 리뷰에서 재현했다.

## 변경 — 2026-10-31

- `backend/src/pool.ts`: 풀의 `error` 이벤트를 로그로 남기는 `createPool` 추가. 끊긴 연결은 풀이 알아서 새로 만든다.
- `backend/src/server.ts`: `createPool`을 쓴다.
- 체크아웃한 연결의 같은 문제는 #22의 `PATCH /api/items/:id`에서 이미 처리했다.

## 테스트

`backend/test/pool.test.ts`:

- DB 없이: 풀 오류가 프로세스를 끝내지 않고 로그로 남는다.
- 실제 DB: `pg_terminate_backend`로 쉬는 연결을 끊어도 `/api/health`가 200으로 응답한다.

## 검증 — 2026-10-31

임시 PostgreSQL 17.11(`journal_test`)을 `TEST_DATABASE_URL`로 지정해 Windows에서 실행했다.

- `npm run check`: 통과. 백엔드 47개 통과·건너뜀 0개, 프론트엔드 80개 통과.
- `npm run knip`: 통과.
- 리스너를 뺀 코드로 `npm test -w backend`를 돌려 새 테스트 2개가 `terminating connection due to administrator command` 오류로 실패하는 것을 확인하고 코드를 되돌렸다.
- 화면 변경이 없어 브라우저 확인은 하지 않았다.
