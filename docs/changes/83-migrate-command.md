# #83 배포 스크립트의 마이그레이션 명령 만들기

- 이슈: [#83](https://github.com/sirloinbh/life-journal/issues/83)
- 브랜치: `chore/83-migrate-command`

## 변경 — 2026-11-04

`deploy/remote-deploy.sh`가 실행하는 `node dist/migrate.js`의 원본이 없었다. 중앙 표준의 공통 마이그레이션 실행기를 들여와 이 명령이 동작하게 했다. 표준 문서 [DB 마이그레이션 규칙](https://github.com/sirloinbh/project-standards/blob/main/docs/conventions/database.md) 8절 "기존 앱에 실행기 들이기"를 따랐다.

- `backend/src/migrations.ts`, `backend/src/migrate.ts`, `backend/test/migrations.test.ts`: `sirloinbh/project-standards`의 `scaffold/app/backend/`(main `6b0e57e`)에서 복사했다.
  - 한 곳만 바꿨다. `checksum()`의 정규식에 BOM 문자가 그대로 들어 있어 이 저장소의 ESLint `no-irregular-whitespace`에 걸렸다. 같은 뜻의 이스케이프 `\uFEFF`로 바꿨다. 테스트는 그대로 통과한다.
- 실행기 동작: `database/migrations/NNN_*.sql`을 이름순으로 파일마다 트랜잭션 안에서 적용하고, `schema_migrations`에 이름과 체크섬을 기록한다. 기록된 파일이 바뀌거나 없어지거나 순서가 어긋나면 아무것도 적용하지 않고 실패한다. 실패하면 종료 코드 1로 끝나 배포 스크립트(`set -e`)가 멈춘다.
- 스크립트: `backend/package.json`과 루트 `package.json`에 `db:migrate`를 더했다. 새 패키지는 없다(`pg`, `tsx`는 이미 의존성). 공통 CI는 `db:migrate`가 있으면 psql 적용 뒤 실행기를 돌린다.
- 경로: 컨테이너에서는 `/app/dist/migrate.js`가 `../../database/migrations/`, 곧 배포 스크립트가 마운트하는 `/database/migrations`를 읽는다. 로컬에서는 저장소의 `database/migrations`를 읽는다.
- `007_coffee_category.sql`에서 `BEGIN`·`COMMIT`을 뺐다. 표준 규칙은 실행기가 파일마다 트랜잭션을 걸므로 파일 안에 직접 쓰지 말라고 한다. 파일 안에서 `COMMIT`하면 실행기의 트랜잭션이 기록 행을 넣기 전에 끝나 버린다. 아직 `schema_migrations`가 있는 DB가 없어 이 파일을 지금 고쳐도 체크섬 문제가 생기지 않는다. 앞으로는 적용한 파일을 고치지 않는다.
- `database/README.md`: psql로 파일을 하나씩 적용하던 안내를 실행기 안내로 바꾸고, 작성 규칙(`BEGIN`·`COMMIT` 금지, 적용한 파일 수정 금지)을 더했다.
- `docs/next-steps/README.md`: 기존 로컬 DB 안내를 `npm run db:migrate`로 바꾸고 #83 줄을 지웠다.

## 테스트

- `backend/test/migrations.test.ts`(표준 사본): DB 없이 체크섬 정규화, 파일 이름·번호 검사, 대기 목록, 바뀐·없어진·순서가 어긋난 파일을 확인한다.
- `backend/test/migrate-command.test.ts`(새로 씀)
  - `DATABASE_URL`이 없으면 명령이 한국어 메시지와 종료 코드 1로 끝난다.
  - 빈 스키마에 실행기가 모든 파일을 적용하고 기록하며, 두 번째에는 아무것도 적용하지 않는다.
  - psql로 이미 모든 파일을 적용한(기록 없는) 스키마에 실행기가 모두 다시 적용하며 기록하고, 기존 행은 그대로 남는다.
  - 명령(`node --import tsx src/migrate.ts`)이 두 번 연속 종료 코드 0으로 끝나고, 기록된 파일의 체크섬이 다르면 종료 코드 1과 한국어 메시지로 끝난다.
  - SQL 실행 중 실패한 파일은 그 파일만 되돌려지고(만든 테이블이 남지 않음), 앞서 성공한 파일의 기록은 남으며, 오류에 파일 이름이 나온다.
  - DB 테스트는 연결 문자열의 `search_path`를 테스트 전용 스키마로 바꿔 `public`을 건드리지 않는다.

## 검증

- 빌드 뒤 `backend/dist/migrate.js`가 생긴다. 이 파일을 `node dist/migrate.js`로 임시 스키마에 두 번 실행했다. 첫 번째는 7개 파일을 적용했고, 두 번째는 "적용할 마이그레이션이 없습니다"로 끝났다.
- `npm run knip`: 통과.
- `npm run check`: 통과(백엔드 155개 통과, 0개 건너뜀, 프론트엔드 150개 통과, 2개 건너뜀, 스킬 4개 통과). DB 통합 테스트는 `TEST_DATABASE_URL`을 설정해 실행했다.
- 표준 원본과 비교: `migrate.ts`, `migrations.test.ts`는 같고, `migrations.ts`는 위 정규식 한 줄만 다르다.
- 화면 변경이 없어 브라우저 확인은 하지 않았다.

## 후속

- 표준 스캐폴드의 `migrations.ts`에도 같은 BOM 문자가 들어 있다. 이 정규식은 ESLint `no-irregular-whitespace`에 걸리므로 중앙 리포에서 고치는 편이 좋다. 중앙 리포 이슈는 사용자 확인 뒤 연다.
- 기존 로컬 DB와 운영 DB에는 아직 `schema_migrations`가 없다. 로컬은 `npm run db:migrate`를 한 번 실행하면 기록된다. 운영은 첫 배포 때 배포 스크립트가 기록한다.

## 리뷰

1차 지적 2건(모두 낮음)을 반영했다.

- 실패 테스트가 체크섬 불일치(적용 전에 실패하는 경로)만 확인했다. SQL 실행 중 실패하면 그 파일만 되돌리고 앞 파일 기록은 남는지 확인하는 DB 테스트를 더했다.
- `backend/test/db.integration.test.ts`의 정리 단계 주석이 "007이 트랜잭션을 연다"고 했는데, 007에서 `BEGIN`을 뺐으므로 맞지 않게 됐다. 주석을 고쳤다.

참고만 한 점: 연결이 끊기면 실행기의 `pg_advisory_unlock`도 실패해 원래 오류 메시지를 덮을 수 있다. 종료 코드는 여전히 0이 아니라 배포는 멈춘다. 중앙 코드라 이 PR에서는 고치지 않았다.

1차 리뷰 반영 뒤 `npm run check`: 통과(백엔드 156개 통과, 0개 건너뜀, 프론트엔드 150개 통과, 2개 건너뜀, 스킬 4개 통과).

2차 리뷰: 1차 지적 2건이 모두 반영됐고 보완점이 없었다.
