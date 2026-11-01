# #59 백엔드 검증 코드를 zod 4 문법으로 옮기기

- 이슈: [#59](https://github.com/sirloinbh/life-journal/issues/59)
- 브랜치: `chore/59-zod4-syntax`

## 목적

중앙 `sirloinbh/project-standards#386`의 1단계다. 중앙이 `zod`를 4.6.7로 올릴 때 이 앱이 깨지지 않도록 코드를 먼저 옮긴다. 보안 권고 GHSA-mrhx-c7xc-m3w5의 Dependabot 알림은 그 동기화로 닫힌다. 이 PR만으로는 닫히지 않는다.

## 변경 — 2026-11-01

- `backend/src/items.ts`가 `zod/v4`에서 불러온다. 설치된 3.25.76에 이 경로가 들어 있어 설치는 바꾸지 않았다.
- `required_error`, `invalid_type_error`, `errorMap`을 `error`로 옮겼다. 메시지 있는 `.strict()`는 `strictObject`로 옮겼다.
- PATCH 스키마에서 기본값을 뺐다. zod 4는 `.default().optional()`에서 기본값을 적용해, 그대로 두면 PATCH에서 보내지 않은 `status`, `details`, `subRatings`가 덮어써진다.

## 바뀌는 응답

세부 평점이나 검색 조건이 객체가 아닐 때의 메시지만 zod 기본 영어 문구에서 한국어 문구로 바뀐다. 두 경우 모두 일반 요청에서는 나오지 않는다. 나머지 메시지는 기존 테스트로 같음을 확인했다.

## 검증

- `npm run check`: 통과(백엔드 114개 통과, 프론트엔드 125개 통과, 2개 건너뜀). 실제 DB 통합 테스트 포함.
- 4.6.7에서의 동작은 아직 확인하지 못했다. 중앙 동기화 PR의 CI로 확인한다.
