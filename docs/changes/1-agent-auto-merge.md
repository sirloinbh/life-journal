# 에이전트 PR 자동 병합 정책 (#1)

- 이슈: https://github.com/sirloinbh/life-journal/issues/1
- 일자: 2026-10-21 (Asia/Seoul)

## 목적

저장소 소유자가 2026-10-21에 병합 정책 변경을 명시적으로 지시했다. "PR 병합은 사용자만 수행한다"는 규칙을 "필수 CI 검사가 모두 통과하면 에이전트가 병합한다"로 바꿔 프로젝트마다 같은 요청을 반복하지 않게 한다.

## 변경 내용

- `AGENTS.md` 구현 절차 5번: CI 통과 후 주 에이전트·로컬 워커가 묻지 않고 `pr merge <url> --merge --match-head-commit <head SHA>`(merge commit)로 병합하고 연결 이슈 종료를 확인한다. 연속 PR 처리 순서와 금지 사항(실패·실행 중 검사, `--admin` 우회, 자기 승인, `main` 직접 커밋·푸시, force push)을 명시했다. 이 프로젝트는 `main` 병합이 배포를 일으키지 않는다고 적었다.
- `skills/life-journal-implementation/SKILL.md`: 머리말 description과 5단계를 "CI 통과 후 병합"으로 바꿨다.
- `skills/life-journal-foundation/SKILL.md`, `skills/life-journal-testing/SKILL.md`: 사용자 전용 병합 문구를 새 정책으로 바꿨다.
- `.claude/skills/`: `npm run skills:sync`로 갱신했다(직접 수정하지 않음).
- `README.md`, `docs/project-setup.md`(안전 규칙 2번, Git 전략, 파일 역할 표, AGENTS 템플릿): 같은 정책으로 맞췄다.
- 과거 기록(`docs/changes/bootstrap.md`, `docs/daily`)은 수정하지 않았다.

## 검증

- `npm run skills:sync` → `npm run skills:check`: `.claude/skills matches skills/.`
- `npm run test:skills`: **4 pass / 0 fail / 0 skip**
- skill-creator `quick_validate.py`(`PYTHONUTF8=1`) 3개 스킬: 모두 `Skill is valid!`
- 변경 파일 포맷: 이 저장소에 `node_modules`가 없어 같은 버전의 prettier 3.9.10(workout-memo 설치본)으로 `prettier --check` 실행: 통과
- 앱 코드 변경이 없어 앱 테스트는 추가하지 않았다. 로컬 `npm run check` 전체는 의존성 미설치(패키지 설치는 사용자 재확인 필요)로 실행하지 않았고 GitHub Actions의 `npm run check`로 확인한다.

## 제한·후속

- 브랜치 보호(필수 검사 지정)는 비공개 저장소 요금제 제약으로 조회되지 않는다(HTTP 403). "필수 CI 검사"는 PR에 보고되는 모든 CI 검사로 해석한다.
