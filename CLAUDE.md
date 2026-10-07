# CLAUDE.md

@AGENTS.md

## Claude Code 전용 구성

이 저장소는 에이전트 규칙을 말로만 두지 않고 도구로 나눠 두었다.

| 구성 | 위치 | 역할 |
| --- | --- | --- |
| 서브에이전트 | `.claude/agents/race-hunter-checklist.md` | 읽기 전용(`Read, Grep, Glob`)으로 쓰기 경로의 경합을 체크리스트로 점검한다. 코드를 고치지 않고 표로만 보고한다. |
| Skill | `.claude/skills/race-check/SKILL.md` | 백엔드 쓰기 경로를 바꿀 때의 절차: 탐지 → 판정(에이전트 결론 재검토) → 재현 테스트 → 수정. |
| Hook (PreToolUse) | `.claude/hooks/no-git.py` | git 상태 변경과 PR·이슈 생성을 차단한다. 조회(status, diff, log)는 허용한다. |
| Hook (PreToolUse) | `.claude/hooks/protect-migrations.py` | 기존 Flyway 마이그레이션 수정을 차단한다. 새 `V{n}__*.sql`은 허용한다. |

- 쓰기 경로(Service, JDBC)를 추가하거나 바꾸면 `race-check` skill을 따른다.
- 이 구성의 근거 실험은 `experiments/race-hunt/README.md`에 있다.
