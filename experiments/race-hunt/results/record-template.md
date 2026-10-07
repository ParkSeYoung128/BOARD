# 실험 결과 기록

- 실행 일시: 2026-10-05 12:44~12:54 (A안 → B안 순, 각 1회)
- Claude Code 버전: v2.1.285
- 모델: Opus 5.5 (A·B 동일)
- 전역 메모리: 신규 설치라 없음
- 전문: snapshot-ed7779f/결과A_basic.txt, 결과B_checklist.txt (아래 A·B 칸의 붙여넣기는 화면 복사라 일부 잘림)

## A안: race-hunter-basic

  ID: F1
  위치(클래스.메서드): PostService.update ↔ LikeService.toggle
  동시 요청 조합: 작성자의 PATCH + 다른 사용자의 좋아요 토글 (같은 글)
  인터리빙 (T1/T2 단계별): ① T1 findLive로 Post를 읽음 (likeCount=100, 잠금 없음) ② T2가 post_likes에 INSERT하고 like_count+1로 101 저장 후 커밋 ③ T1이 flush 시 update posts set ..., like_count=100, ... 
  where id=? 실행 후 커밋. T2가 T1 flush 전에 UPDATE까지 했다면 T1이 행 잠금을 기다렸다가, 커밋 후 같은 조건으로 다시 평가해 100으로 덮어씀
  깨지는 불변식 / 결과: like_count와 post_likes 기록 수 일치 불변식이 깨짐. 좋아요 기록은 있는데 카운트에 반영되지 않음(lost update). 반대로 취소가 사라지면 카운트가 실제보다 커짐. decrement의
  greatest(...,0) 때문에 어긋남이 0에서 가려져 드러나지 않을 수 있음. 인기 글일수록 잘 일어남
  확신도: 상
  재현 테스트 아이디어: TransactionTemplate으로 T1을 열고 posts.findByIdAndDeletedAtIsNull로 읽은 뒤 edit 호출. 커밋 전에 별도 스레드에서 likeService.toggle을 실행하고 join해서 커밋까지 끝냄(T1은 아직
  잠금이 없어 막히지 않음). 이어서 T1 커밋. like_count == 초기값+1이고 count(post_likes)==1인지 검증. sleep 없이 순서가 결정됨
  수정 후보: likeCount에 @Column(insertable=false, updatable=false)(DB 기본값 0 사용) 지정 + @DynamicUpdate. 또는 findLive에 PESSIMISTIC_WRITE 대신 FOR NO KEY UPDATE 사용(FOR UPDATE는 FK KEY SHARE와 충돌해
  
  댓글·좋아요 INSERT까지 막음)
  ────────────────────────────────────────
  ID: F2
  위치(클래스.메서드): PostService.delete ↔ LikeService.toggle
  동시 요청 조합: 작성자의 DELETE + 다른 사용자의 좋아요 토글
  인터리빙 (T1/T2 단계별): ① T1이 Post를 읽음 (likeCount=100) ② T2 토글: existsLive가 true, INSERT 후 increment로 101, 커밋 ③ T1이 softDelete 후 flush하면서 like_count=100, deleted_at=now로 덮어쓰고 커밋
  깨지는 불변식 / 결과: like_count/post_likes 불변식이 DB 수준에서 깨짐. 삭제된 글이라 화면에는 보이지 않지만 데이터는 어긋난 채 남음. 나중에 복구하거나 통계를 내면 드러남
  확신도: 상
  재현 테스트 아이디어: F1과 같은 방식(T1에서 softDelete). 커밋 후 JDBC로 like_count와 count(post_likes)를 비교
  수정 후보: F1 수정으로 함께 해결됨. 또는 삭제를 조건부 원자 UPDATE로 처리: update posts set deleted_at=? where id=? and deleted_at is null
  ────────────────────────────────────────
  ID: F3
  위치(클래스.메서드): PostService.update ↔ PostService.delete
  동시 요청 조합: 같은 작성자가 두 탭(또는 재시도)에서 PATCH와 DELETE를 동시에 보냄
  인터리빙 (T1/T2 단계별): ① T1(update)이 Post를 읽음 (deletedAt=null) ② T2(delete)가 softDelete하고 커밋 ③ T1이 flush하면서 update posts set title=?, ..., deleted_at=NULL where id=? 실행. WHERE 조건이
  id뿐이라 다시 평가해도 매칭되고, 커밋됨
  깨지는 불변식 / 결과: 삭제 불변식이 깨짐(삭제된 글이 부활). DELETE는 204로 응답했는데 글이 목록·상세에 다시 나타나고 댓글도 다시 보임. 같은 이유로 like_count도 덮어씀
  확신도: 상                                                                               Jump to bottom (click) ↓ 
                                                                                                                                                                             
## B안: race-hunter-checklist
  확신도 / 심각도: 상 / 낮음
  재현 테스트 아이디어: 커넥션 C에서 제목 UPDATE를 잡아 둔 채 delete 호출, 커밋 뒤 title 확인.
  수정 후보: R2와 같은 해결책(@DynamicUpdate 또는 조건부 UPDATE).
  ────────────────────────────────────────
  ID: R6
  위치(클래스.메서드): PostService.delete / CommentService.delete (CommentService.java:57-63)
  동시 요청 조합: W3×W3, W5×W5 (같은 사용자의 중복 삭제 요청)
  인터리빙 (T1/T2 단계별): T1, T2 모두 "살아 있음"으로 읽음. 둘 다 UPDATE … deleted_at=now. T2는 T1 락을 기다렸다가 조건(id만)이 통과해 덮어씀. 둘 다 204.
  깨지는 불변식 / 결과: 두 번째 요청이 404가 아니라 204를 받고 deleted_at이 덮어써집니다. "삭제된 리소스는 404" 판정 순서 계약 위반이지만 데이터 영향은 거의 없습니다.
  확신도 / 심각도: 상 / 낮음
  재현 테스트 아이디어: 커넥션 C에서 UPDATE … SET deleted_at 후 커밋하지 않고 서비스 delete 호출, 대기 확인, 커밋. 204 확인.
  수정 후보: 조건부 UPDATE … WHERE id=? AND deleted_at IS NULL의 영향 행 0이면 404. 또는 FOR NO KEY UPDATE로 락 걸고 다시 조회.
  ────────────────────────────────────────
  ID: R7
  위치(클래스.메서드): LikeService.toggle (LikeService.java:36-45)
  동시 요청 조합: W6 × W6 × W6 … (같은 사용자 4회 이상 연타)
  인터리빙 (T1/T2 단계별): 매 시도마다 INSERT가 0행(다른 요청이 삽입 후 커밋), DELETE가 0행(다른 요청이 먼저 삭제)이 3번 반복된 뒤 45행의 대체 경로로 감.
  깨지는 불변식 / 결과: 기록 변경 없이 현재 상태만 반환합니다. 기록과 카운트가 항상 짝으로 바뀌므로 불변식은 깨지지 않습니다. 다만 "토글" 요청이 아무것도 하지 않고 200을 받을 수 있어, 재시도가 문제를
  완전히
  해결하지는 않습니다.
  확신도 / 심각도: 중 / 낮음
  재현 테스트 아이디어: 스파이로 insertIfAbsent/delete 사이에 다른 트랜잭션의 삽입/삭제 커밋을 강제로 끼워 넣음.
  수정 후보: pg_advisory_xact_lock(hashtext(post_id‖user_id)) 또는 SELECT … FROM posts WHERE id=? FOR NO KEY UPDATE로 같은 사용자의 토글을 직렬화(글 단위 락은 다른 사용자 토글도 직렬화하므로 키 단위
  advisory lock이 낫습니다).
  
  에이전트가 함께 남긴 참고 사항
  
  - 시드 적재는 검토하지 못했어요. 이 스냅샷에는 문서에 나오는 SeedLoader가 없어서, 재기동과 동시 기동 경합은 분석 대상에서 빠졌습니다.
  - 분석 기준: PostgreSQL의 READ COMMITTED 격리 수준을 전제로 했어요. 또 Post에 @DynamicUpdate, @Version, updatable=false가 하나도 없어서 UPDATE가 모든 컬럼을 다시 쓴다고 보았습니다.
  - 정해 주셔야 할 점: like_count의 기준이 문서마다 달라요. CLAUDE.md는 "post_likes 기록 수와 일치", API 계약서와 LikeService 주석은 "시드 초기값 + 기록 수"입니다. 어느 기준이든 R1과 R4는 성립하지만, 재현
    테스트를 쓰기 전에 하나로 정해야 합니다.
  - 안전하다고 본 경합: 다른 사용자끼리 동시에 좋아요를 누르는 경우, 같은 사용자가 두 번 토글하는 경우, 글 작성, 서로 다른 댓글을 다루는 경우, commentCount(조회 때마다 세는 값)는 안전하다고 판단했습니다.
    
  이 중 수정할 항목을 고르시면, 프로젝트 규칙에 따라 재현 테스트를 먼저 쓰고 수정 전 코드에서 실패하는지 확인하는 계획부터 정리해 드릴게요.
    
✻ Sautéed for 3m 18s · done 12:54 PM

─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ 
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  ⏸ manual mode on · ? for shortcuts · ← for agents
## 채점 (정답지 기준)
| 결함 | A안 (basic) | B안 (checklist) | 비고 |
| --- | --- | --- | --- |
| D1 연타 경합 | ✕ (F 없음, "같은 사용자의 좋아요 연타는 안전"이라고 판정) | ○ (R7, 재시도로 해결 안 됨 + 키 단위 advisory lock 제안) | B도 심각도는 "낮음"으로 과소평가 |
| D2 like_count 덮어쓰기 | ○ (F1 수정, F2 삭제) | ○ (R1 수정, R4 삭제) | 둘 다 수정안 `updatable=false` 제시 |
| D3 삭제 중 댓글 작성 | ○ (F4) | ○ (R3) | 둘 다 FOR SHARE 제안(실제는 KEY SHARE + 삭제 FOR UPDATE) |
| D4 삭제된 글 부활 | ○ (F3) | ○ (R2, FOR NO KEY UPDATE 권장까지 실제와 동일) | |
| **탐지 수 (○)** | 3/4 | 4/4 | |
| 오탐 수 | 0 (F7 read skew는 실재하나 설계상 허용 범위) | 0 | |
| 추가 발견 | F5 중복 삭제 204, F6 글 삭제 중 댓글 삭제 204, F7 목록 total/items 불일치 | R5 삭제가 직전 수정 덮어씀, R6 중복 삭제 204 | 모두 데이터 영향 경미 |
| 기타 | | CLAUDE.md의 like_count 기준(시드 초기값 누락)과 API 계약서의 불일치를 지적 | |

## 한 줄 결론 (요약)
결함 수정 전 코드(ed7779f)에 경합 탐색 서브에이전트를 돌리자, 일반 지시로는 4건 중 3건을 찾고 실제 CI를 깨뜨린 연타 경합은 "안전"으로 판정했다. 경합 유형 체크리스트를 주자 4건을 모두 찾았지만, 연타 경합의 심각도는 여전히 "낮음"으로 판단했다. (각 1회 실행, Opus 5.5)
