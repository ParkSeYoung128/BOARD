# API 계약서 (v1)

백엔드 기준 URL: `http://localhost:8080/api` · 요청/응답 본문은 JSON (UTF-8)

## 1. 공통 규칙

### 요청자 식별
1. `x-user-id` **헤더** → 2. `x-user-id` **쿠키** → 3. 둘 다 없으면(또는 공백이면) `demo_user`
- 앞뒤 공백은 제거한다. 쿠키 값은 URL 디코딩해서 읽는다. 50자를 넘으면 `400 VALIDATION_ERROR`.
- 게시글·댓글의 `author`가 요청자와 같으면 본인 것이다.

### 시각 형식
- 모든 `createdAt`은 UTC ISO-8601 **초 단위** `2026-08-30T13:55:54Z`.
- 서버는 저장 시 `Instant.now().truncatedTo(SECONDS)`로 절삭해 저장·응답 형식과 DB 값을 일치시킨다.

### 오류 응답 (요구사항이 상태 코드 값을 정하지 않아 관례를 따른다)
```json
{ "code": "NOT_FOUND", "message": "게시글을 찾을 수 없습니다." }
```
| HTTP | code | 상황 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 제목/내용 누락·공백, 제목 20자 초과(코드포인트 기준), 길이 초과, `limit` < 1 또는 숫자가 아님 |
| 400 | `INVALID_CURSOR` | 해석할 수 없는 `cursor` |
| 403 | `FORBIDDEN` | 남의 글·댓글을 수정/삭제 |
| 404 | `NOT_FOUND` | 없거나 **삭제된** 글·댓글, 삭제된 글의 댓글 관련 요청 |

판정 순서: **404(없음/삭제됨) → 403(소유자 아님) → 400(본문 검증)**. 삭제된 리소스는 존재 여부를 노출하지 않는다.

### 삭제 정책 (게시글·댓글 공통)
- 행을 지우지 않고 `deleted_at`만 채운다(soft delete). 모든 조회·집계·좋아요·댓글 작성에서 제외한다.
- 글이 삭제되면 그 글의 댓글도 조회되지 않는다(댓글 행은 그대로 둔다).

## 2. 객체

### Post
```json
{
  "id": 1, "title": "수분크림 써보신 분 계세요?", "content": "…",
  "likeCount": 1796, "commentCount": 2, "isLiked": false,
  "author": "demo_user", "createdAt": "2026-08-30T13:55:54Z"
}
```
- `commentCount`: 삭제되지 않은 댓글 수. `isLiked`: 요청자 기준.
- **항목(Post/Comment)에는 요구사항 예시 이외의 필드를 추가하지 않는다.**
- 구현 주의: Jackson이 `isLiked`를 `liked`로 바꾸지 않도록 **record**로 직렬화한다.

### Comment
```json
{ "id": 2, "postId": 1, "content": "…", "author": "soft_toner", "createdAt": "2026-08-30T14:02:33Z" }
```

### 목록 봉투 (유일하게 `nextCursor`를 추가)
```json
{ "items": [ … ], "total": 39, "nextCursor": "MTc4ODEwMDAwMF8xMg" }
```
- `total`: 조건에 맞는 **전체 개수**(삭제 제외). 이번 응답의 개수가 아니다.
- `nextCursor`: 다음 페이지가 있으면 불투명 문자열, **마지막 페이지면 `null`**.

## 3. 엔드포인트

### 페이지네이션 규칙 (목록 2종 공통)
- 쿼리: `limit`(기본 20, 최대 50 — 50 초과는 50으로 보정, 1 미만은 400), `cursor`(선택, 이전 응답의 `nextCursor`)
- 정렬: `created_at DESC, id DESC` (keyset). 시드의 id 순서와 시간 순서가 일치하지 않으므로 id 단독 정렬 금지.
- 커서 인코딩: `base64url("{createdAtEpochSecond}_{id}")` — 클라이언트는 해석하지 않는다.
- 구현: `limit + 1`건을 조회해 초과분 유무로 `nextCursor`를 만든다(count 쿼리는 `total` 용으로 1회).

| 메서드 | 경로 | 성공 | 설명 |
| --- | --- | --- | --- |
| GET | `/posts?limit&cursor` | 200 `{items,total,nextCursor}` | 게시글 최신순 |
| POST | `/posts` | 201 Post | 본문 `{title,content}` · 작성자=요청자 |
| GET | `/posts/{postId}` | 200 Post | 상세 |
| PATCH | `/posts/{postId}` | 200 Post | 본문 `{title,content}` · 본인 글만 · 제약은 작성과 동일 |
| DELETE | `/posts/{postId}` | 204 | soft delete · 본인 글만 |
| POST | `/posts/{postId}/likes/toggle` | 200 `{isLiked,likeCount}` | 좋아요 토글 |
| GET | `/posts/{postId}/comments?limit&cursor` | 200 `{items,total,nextCursor}` | 댓글 최신순 |
| POST | `/posts/{postId}/comments` | 201 Comment | 본문 `{content}` |
| DELETE | `/comments/{commentId}` | 204 | soft delete · 본인 댓글만 |
| GET | `/health` | 200 | **경로·200 유지** (`/api` 접두사 없음) |

### 검증
- `title`: strip 후 비어 있지 않음, **코드포인트 20자 이하**(이모지 1자=1). `content`: strip 후 비어 있지 않음, 20,000자 이하.
- 댓글 `content`: strip 후 비어 있지 않음, 5,000자 이하.
- 요구사항이 규정한 길이 제한은 **제목 20자뿐**이다. 내용·댓글 상한은 비정상적으로 큰 입력만 막는 방어용 값이며 **자율 구현**이다(README 기록).
- 수정(`PATCH`)은 두 필드를 모두 요구한다(작성 화면과 동일한 폼).

### 좋아요 토글 (동시성)
한 트랜잭션 안에서 처리한다.
1. `INSERT INTO post_likes … ON CONFLICT DO NOTHING` — 1행 삽입되면 `like_count = like_count + 1` → `isLiked=true`
2. 삽입 0행이면 `DELETE FROM post_likes WHERE post_id=? AND user_id=?` — 1행 삭제되면 `like_count = like_count - 1` → `isLiked=false`
3. `UPDATE … RETURNING like_count`로 반영값을 반환한다.
- 카운터는 엔티티 read-modify-write가 아니라 **원자적 UPDATE**로 갱신한다(lost update 방지).
- `like_count`의 초기값은 시드의 `likeCount`이며, 좋아요 기록은 비어 있다.

### 시드 적재
- 앱 기동 시(웹 서버가 요청을 받기 전, `/health` 200이면 적재 완료) `APP_SEED_PATH`의 JSON을 **JDBC 배치**로 적재: `INSERT … ON CONFLICT (id) DO NOTHING`, 한 트랜잭션 + `pg_advisory_xact_lock`으로 동시 기동 보호.
- `deletedPostIds`/`deletedCommentIds`는 행을 넣은 뒤 `deleted_at`을 채운다(최초 적재 시에만).
- 적재 후 두 테이블의 IDENTITY 시퀀스를 `max(id)`로 `setval` → 새 글·댓글 PK 충돌 방지.
- 재기동해도 `DO NOTHING`이라 중복 적재·삭제 부활이 없다.

## 4. 프론트엔드가 지켜야 할 것
- 브라우저 호출은 `credentials: "include"`.
- 목록·댓글은 `nextCursor === null`이면 끝. 댓글은 첫 요청 `limit=2`, "더보기" 이후 `cursor`+`limit=20`. 더보기 버튼은 `total > 2`일 때만.
