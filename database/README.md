# 감상문·일기장 PostgreSQL

PostgreSQL 17. 마이그레이션 원본은 `migrations/NNN_<설명>.sql` 한 곳뿐이다. 중앙 표준의 [DB 마이그레이션 규칙](https://github.com/sirloinbh/project-standards/blob/main/docs/conventions/database.md)을 따른다.

## 적용 방법

공통 실행기(`backend/src/migrations.ts`, 명령은 `backend/src/migrate.ts`)로 적용한다. 루트에서 실행하고, `.env`의 `DATABASE_URL`을 쓴다.

```powershell
npm run db:migrate -- --status   # 적용됨·대기 목록만 본다. DB를 바꾸지 않는다
npm run db:migrate               # 대기 중인 파일을 이름순으로 적용한다
```

- 실행기는 파일마다 트랜잭션을 걸고, 적용한 파일을 `schema_migrations`에 체크섬과 함께 기록한다. 실패하면 그 파일만 되돌리고 0이 아닌 종료 코드로 멈춘다.
- 기록 테이블이 없는 DB(이전에 psql로 적용한 DB)에서 처음 실행하면 `001`부터 모두 다시 적용하고 기록한다. 그래서 모든 파일은 다시 실행해도 안전해야 한다.
- 빈 Docker 볼륨에서는 최초 실행 때 모든 파일이 이름순으로 자동 적용된다(기록 없음). 그 뒤 `npm run db:migrate`를 한 번 실행해 기록을 남긴다.
- 운영 배포는 `deploy/remote-deploy.sh`가 덤프를 만든 뒤 API 이미지 안에서 `node dist/migrate.js`로 같은 실행기를 돌린다.
- CI는 psql로 한 번 적용한 뒤 실행기를 돌려, 다시 실행해도 안전한지 함께 확인한다.

## 작성 규칙

- 모든 마이그레이션은 다시 실행해도 안전하게 쓴다(`IF NOT EXISTS`, 이름으로 지운 뒤 다시 만들기 등).
- 파일 안에 `BEGIN`·`COMMIT`을 쓰지 않는다. 실행기가 감싼다. psql 메타 명령(`\i`, `\set`)도 쓰지 않는다.
- 적용한 파일은 고치지 않는다. 주석 한 글자도 체크섬을 바꿔 실행기가 멈춘다. 바꿀 내용은 새 번호의 파일로 추가한다.
- 병렬 브랜치는 착수 시 번호를 예약한다. 기존 데이터의 의미를 보존하고, 확인하지 못한 값은 NULL로 둔다. SQL의 한글 리터럴은 가능하면 `U&'\\XXXX'` 이스케이프를 쓴다.
- psql로 직접 적용해야 할 때는 `Get-Content … | psql`처럼 PowerShell 파이프로 넘기지 않는다. Windows PowerShell 5.1은 외부 프로그램으로 ASCII를 보내 한글이 `?`로 깨진다. 실행기는 Node가 파일을 UTF-8로 직접 읽는다.
