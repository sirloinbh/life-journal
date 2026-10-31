# #32 API에 앱 수준 요청 제한 추가

- 이슈: [#32](https://github.com/sirloinbh/life-journal/issues/32)
- 브랜치: `feat/32-api-rate-limit`

## 목적

PR #30의 `CodeQL` 체크가 `js/missing-rate-limiting` 경고로 실패했다. 사용자가 경고를 오탐 처리하지 않고 앱에 제한을 넣기로 했다(2026-10-31). nginx를 거치지 않는 경로에도 제한이 적용된다.

## 변경 — 2026-10-31

- `backend/src/app.ts`: `/api` 전체에 IP당 1분 600회 제한. 넘으면 429와 한국어 메시지로 응답한다. 값은 사용자가 정했고, `frontend/nginx.conf`의 10r/s와 같은 수준이다.
- JSON 본문을 읽기 전에 제한을 검사한다.
- 카운터는 프로세스 메모리에 있어 API를 다시 시작하면 초기화된다.
- nginx 뒤에서는 모든 요청이 nginx의 IP로 세어진다. 사용자가 1명이라 그대로 둔다. 외부 공개 때 다시 본다.

### 패키지

사용자가 위험을 확인하고 직접 설치했다(`npm install --ignore-scripts --save-exact -w backend express-rate-limit@8.7.1`). `backend/package-lock.json`은 `npm run lockfiles:sync`로 맞췄다.

| 패키지                     | 게시일     | 비고                                                 |
| -------------------------- | ---------- | ---------------------------------------------------- |
| `express-rate-limit` 8.7.1 | 2026-10-06 | 직접 의존성, 게시 25일 경과. 설치 스크립트 없음      |
| `ip-address` 10.7.5 (간접) | 2026-10-25 | 게시 6일째. npm이 범위(`^10.2.0`) 안의 최신을 골랐다 |

`debug`는 이미 있던 버전을 쓴다. 다른 패키지의 버전은 바뀌지 않았다.

## 테스트

- `backend/test/health.test.ts`: 600번째 요청까지 통과하고, 그다음 요청은 429와 한국어 메시지를 받는 것을 확인한다.

## 검증 — 2026-10-31

임시 PostgreSQL 17.11(`journal_test`)을 `TEST_DATABASE_URL`로 지정해 Windows에서 실행했다.

- `npm run check`: 통과. 백엔드 6개 통과·건너뜀 0개, 프론트엔드 52개 통과.
- `npm run knip`: 통과.
- `node .standards/ioc-scan.mjs`: 의심 항목 없음.
- `CodeQL` 경고가 사라지는지는 PR #30에 이 변경을 병합한 뒤 확인한다. #30의 경로가 아직 `main`에 없어 이 PR에서는 확인할 수 없다.

## 리뷰 — 2026-10-31

head `4eb27fc`를 분리된 에이전트가 리뷰했다. 지적은 1건이고 코드 수정이 없어 2차 리뷰는 하지 않는다.

- `frontend/nginx.conf`의 주석 "The API itself has no limit"이 이 변경 뒤로 사실이 아니다. 중앙 관리 파일이라 [#34](https://github.com/sirloinbh/life-journal/issues/34)로 분리했다.
- 리뷰어가 빌드 결과를 실행해 601번째 요청의 429와 `{ error }` 형식, 위조한 `X-Forwarded-For`로 우회되지 않는 것을 확인했다.
- API 시작 후 첫 요청에 클라이언트가 보낸 `X-Forwarded-For`나 `Forwarded`가 있으면 패키지 경고가 로그에 1회 남는다. 응답은 정상이라 그대로 둔다.
