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

전환 전, 3.25.76의 `zod/v4`, 4.6.7의 `zod/v4`로 같은 요청 14,427건을 보내 비교했다. 상태 코드가 바뀌거나 거부되던 입력이 통과한 경우는 없었다. 그 뒤 타입 오류에 길이 오류 문구가 덧붙던 차이를 `.refine`으로 고쳤다. 남은 차이는 잘못된 입력에 대한 400 문구 둘이다.

- `costKrw`가 `1e400`이면 0원 이상 문구만 나온다. 전에는 상한 문구도 함께 나왔다. zod 4가 `Infinity`를 타입 단계에서 거절하기 때문이다.
- 3.25.76에서만 `details`, `subRatings`에 `constructor` 키가 있으면 형식 오류 문구가 나온다. 4.6.7에서는 전과 같다.

## 검증

- `npm run check`: 통과(백엔드 116개 통과, 프론트엔드 125개 통과, 2개 건너뜀). 실제 DB 통합 테스트 포함.
- 위 비교는 `.refine`으로 고치기 전에 돌렸다. 고친 뒤에는 `npm run check`와 타입 오류 테스트로 확인했다.
- 4.6.7은 knip이 함께 설치한 사본으로 시험했다. 이 앱이 4.6.7로 실행되는 것은 중앙 동기화 PR의 CI로 확인한다.
