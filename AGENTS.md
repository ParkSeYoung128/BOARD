# AGENTS.md — AI 에이전트 작업 지침

이 저장소에서 AI 코딩 에이전트(Claude 등)와 함께 일할 때 지키는 규칙입니다. 에이전트에게 매번 말로 반복하지 않으려고 문서로 남겼고, 실제 작업에서 이 규칙대로 진행했습니다. 과정의 실제 사례는 [`docs/development-log.md`](./docs/development-log.md)에 있습니다.

## 작업 절차 (사람이 최종 결정한다)

1. **먼저 읽고 확인한다.** 질문이 "설계가 막고 있는가 / 테스트만 없는가" 같은 것이면 코드를 읽어 사실부터 확인하고 답한다. 추측으로 답하지 않는다.
2. **고치기 전에 변경 요약을 제시하고 승인을 기다린다.** 무엇을·왜·어떤 대안과 비교해 바꾸는지, 영향 범위를 먼저 적는다.
3. **재현 테스트가 먼저다.** 쓰기 경로를 바꾸면 `race-check` skill(`.claude/skills/race-check`)의 절차를 따른다. 버그·경합은 실패하는 테스트로 먼저 재현하고, 수정 후 통과하는 것을 확인한다. 고친 코드를 되돌렸을 때 테스트가 실패하는지도 확인한다.
4. **실행하지 못한 검증은 실행했다고 쓰지 않는다.** 에이전트 환경에서 Gradle·Docker를 돌릴 수 없으면 그 사실을 밝히고, 사람이 실행할 명령을 알려 준다.
5. **외부 리뷰(사람·CodeRabbit·다른 AI)는 코드로 검증한 뒤 반영한다.** 유효한 지적만 고치고, 사소하거나 불필요한 것은 코드를 바꾸지 않고 이유를 남긴다.
6. **문서는 코드와 맞춘다.** 문서에 적힌 주장(도구, 동작, 수치)이 실제 코드에 있는지 대조한다. 없는 것은 문서에서 지운다.

## 에이전트가 하지 않는 일

- `git commit`, 브랜치 생성, PR 생성/게시는 하지 않는다. 사람이 직접 한다. 이 규칙은 `.claude/hooks/no-git.py`가 도구 수준에서도 차단한다. 에이전트는 커밋 메시지·PR 본문을 복사 가능한 텍스트로 제안만 한다.
- 승인 없이 의존성 추가, 스키마 변경(Flyway 파일 수정), 공개 API 필드 추가를 하지 않는다.

## 불변식 (어떤 변경도 깨면 안 된다)

- 삭제된 글·댓글은 목록, 상세, `commentCount`, 댓글 목록, 좋아요, 댓글 작성 어디에서도 존재하지 않는 것처럼 동작한다. 엔티티 경로는 `@SQLRestriction`이 걸러 주지만 JDBC·네이티브 쿼리에는 적용되지 않으므로 `deleted_at IS NULL`을 직접 쓴다.
- 판정 순서는 404 → 403 → 400. 요청자는 `x-user-id` 헤더 → 쿠키 → `demo_user`.
- 게시글의 `like_count`는 시드 초기값 + `post_likes` 기록 수와 항상 일치해야 하며 음수가 될 수 없다.
- 시드의 id는 그대로 유지하고, 재기동해도 중복 적재하지 않는다.
- 제목은 코드포인트 기준 최대 20자, 제목·내용 필수.

## 프로젝트 규칙

### 백엔드 (Java 17 · Spring Boot 3 · PostgreSQL)
- 쓰기는 JPA, 목록·상세 조회는 JPQL DTO 프로젝션, 좋아요·시드는 `JdbcTemplate`. 스키마는 Flyway(`V1__init.sql`)가 소유하고 `ddl-auto=validate`.
- 삭제는 soft delete(`deleted_at` + `@SQLRestriction`). 삭제된 글·댓글이 어떤 경로(목록, 상세, 댓글 수, 댓글, 좋아요)로도 보이면 안 된다.
- 페이지네이션은 keyset(`created_at DESC, id DESC`), 커서는 불투명 문자열. 오프셋을 쓰지 않는다.
- 동시성 규칙: 댓글 작성은 글 행 `FOR KEY SHARE`, 글 삭제는 `FOR UPDATE`, 글 수정은 `FOR NO KEY UPDATE`. `FOR SHARE`는 `like_count` UPDATE와 충돌하므로 쓰지 않는다. 좋아요 토글은 (글, 사용자) advisory lock.
- 경합 테스트는 `sleep`이 아니라 `LockProbe`(별도 커넥션이 락을 쥔 채 대기)와 `pg_stat_activity`의 `Lock` 대기 폴링으로 결정적으로 만든다.
- 테스트 DB는 H2가 아니라 Testcontainers PostgreSQL 16.

### 프론트엔드 (Next.js 15 · React 19 · TypeScript)
- 서버 상태는 TanStack Query, UI 상태는 최소한(Zustand는 토스트만). 같은 글이 여러 캐시에 있으므로 변경 후 캐시를 함께 맞춘다.
- 파생 가능한 상태는 `useState`로 따로 두지 않는다(예: 댓글 "더보기" 펼침은 캐시된 페이지 수에서 계산).
- 제목 길이는 서버와 같은 **코드포인트** 기준. 한글 조합 중 Enter는 제출하지 않는다.
- 테스트는 Vitest + React Testing Library. Node 22 이상(`.nvmrc`).

### 실행·검증 명령
```bash
docker compose up --build          # 전체 실행 (http://localhost:3000)
cd backend && ./gradlew test       # Docker 필요 (Testcontainers)
cd frontend && npm ci && npm run typecheck && npm test && npm run build
```

### 커밋·PR
- 커밋은 한 가지 이유 단위로 나눈다(테스트 / 수정 / 문서 분리).
- PR 본문에는 문제, 원인, 해결, 검증 방법(실행한 것과 실행하지 못한 것)을 적는다.
