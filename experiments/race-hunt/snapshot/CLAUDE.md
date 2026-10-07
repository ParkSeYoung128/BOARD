# BOARD — 프로젝트 규칙

## 문서 우선순위
1. `docs/api-contract.md` (API 계약: 요청자 식별, 오류 코드, 판정 순서)
2. `docs/architecture.md` (스키마, 구조, 라우팅)
문서끼리 상충하거나 요구사항이 모호하면 추측해서 구현하지 말고 질문한다.

@docs/api-contract.md
@docs/architecture.md

## 불변식 (어떤 변경도 깨면 안 된다)
- 삭제된 글·댓글은 목록, 상세, commentCount, 댓글 목록, 좋아요, 댓글 작성 어디에서도 존재하지 않는 것처럼 동작한다.
  - 엔티티 경로는 `@SQLRestriction`이 걸러 주지만, JDBC·네이티브 쿼리에는 적용되지 않으므로 `deleted_at IS NULL`을 직접 쓴다.
- 판정 순서는 404 → 403 → 400. 요청자는 `x-user-id` 헤더 → 쿠키 → `demo_user`.
- 게시글의 `like_count`는 `post_likes` 기록 수와 항상 일치해야 하며, 음수가 될 수 없다.
- 시드의 id는 그대로 유지하고, 재기동해도 중복 적재하지 않는다.
- 제목은 코드포인트 기준 최대 20자, 제목·내용 필수.

## 구조 규칙
- 기능별 패키지(post / comment / like). 애그리거트 간 JPA 연관관계를 두지 않는다.
- 쓰기는 엔티티, 목록 읽기는 DTO 프로젝션, 카운터 갱신과 대량 적재는 원자적 SQL(JDBC).

## 테스트 규칙
- 통합 테스트는 Testcontainers PostgreSQL. H2 금지(부분 인덱스, ON CONFLICT, 락 모드를 증명할 수 없다).
- 버그는 재현 테스트를 먼저 쓰고, 고치기 전 코드에서 실패하는 것을 확인한 뒤 수정한다.
- 동시성 테스트는 sleep 같은 타이밍에 기대지 않는다.

## 작업 규칙
- 코드를 바꾸기 전에 변경 계획을 요약해 제시하고 승인을 기다린다.
- git commit / push / merge, 브랜치 생성은 하지 않는다(사람이 직접 한다).
