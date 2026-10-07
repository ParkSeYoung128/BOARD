package io.github.parkseyoung128.board.post;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostRepository extends JpaRepository<Post, Long> {

    /**
     * 목록·상세 공통 조회. commentCount, isLiked 를 서브쿼리로 한 번에 가져와 N+1 을 막는다.
     * 컬렉션 연관관계나 fetch join 은 쓰지 않는다. (엔티티의 @SQLRestriction 이 삭제된 글·댓글을 제외한다.)
     */
    String SELECT_VIEW = """
            select new io.github.parkseyoung128.board.post.PostResponse(
                p.id, p.title, p.content, p.likeCount,
                (select count(c) from Comment c where c.postId = p.id and c.deletedAt is null),
                case when exists (select 1 from PostLike l where l.postId = p.id and l.userId = :me)
                     then true else false end,
                p.author, p.createdAt)
            from Post p
            """;

    @Query(SELECT_VIEW + " order by p.createdAt desc, p.id desc")
    List<PostResponse> findFirstPage(@Param("me") String me, Pageable pageable);

    /** 커서보다 "뒤"(더 오래됐거나, 같은 시각에서 id 가 더 작은) 항목. null 파라미터를 피하려고 첫 페이지와 분리했다. */
    @Query(SELECT_VIEW + """
             where (p.createdAt < :cursorAt or (p.createdAt = :cursorAt and p.id < :cursorId))
             order by p.createdAt desc, p.id desc
            """)
    List<PostResponse> findPageAfter(@Param("me") String me,
                                     @Param("cursorAt") Instant cursorAt,
                                     @Param("cursorId") long cursorId,
                                     Pageable pageable);

    @Query(SELECT_VIEW + " where p.id = :id")
    Optional<PostResponse> findView(@Param("id") Long id, @Param("me") String me);

    @Query("select count(p) from Post p")
    long countLive();

    /** 삭제되지 않은 글이 있는지. 댓글·좋아요가 글의 존재(404)를 판단할 때 쓴다. */
    @Query("select case when count(p) > 0 then true else false end from Post p where p.id = :id")
    boolean existsLive(@Param("id") Long id);

    Optional<Post> findByIdAndDeletedAtIsNull(Long id);

    /**
     * 댓글 작성용: 글이 살아 있는지 확인하면서 그 행에 KEY SHARE 락을 건다. 트랜잭션이 끝날 때까지 유지된다.
     * 글 삭제는 {@link #lockLiveForUpdate}(FOR UPDATE)를 걸기 때문에, 두 요청은 서로를 기다려 순서가 정해진다.
     * <ul>
     *   <li>FOR SHARE 는 쓰지 않는다. 좋아요의 like_count UPDATE(NO KEY UPDATE)와 충돌해 인기 글에서 대기가 생긴다.
     *       KEY SHARE 는 이 UPDATE 와 충돌하지 않는다.</li>
     *   <li>일반 SELECT 로 확인만 하면 확인과 INSERT 사이에 삭제가 커밋될 수 있다. 삭제는 soft delete 라 FK 도 막아 주지 않는다.</li>
     * </ul>
     * 삭제된 글이거나 없는 글이면 빈 값을 돌려준다. 락을 기다린 뒤에는 조건을 다시 평가하므로, 대기 중에 삭제가 커밋되면 빈 값이 된다.
     */
    @Query(value = "select id from posts where id = :id and deleted_at is null for key share", nativeQuery = true)
    Optional<Long> lockLiveForKeyShare(@Param("id") Long id);

    /**
     * 글 수정용: FOR NO KEY UPDATE. 수정은 행을 읽은 값으로 UPDATE 하므로, 삭제가 먼저 커밋되면 deleted_at 을 null 로 덮어써
     * 삭제된 글이 되살아난다. 먼저 이 락을 잡으면 삭제(FOR UPDATE)와 충돌해 순서가 정해지고, 삭제가 먼저면 빈 값(404)이 된다.
     * <ul>
     *   <li>FOR UPDATE 는 쓰지 않는다. 진행 중인 댓글 작성(KEY SHARE)까지 막는데, 수정이 그럴 이유는 없다.</li>
     *   <li>FOR NO KEY UPDATE 는 KEY SHARE 와 충돌하지 않는다. 좋아요의 like_count UPDATE 와는 충돌하지만,
     *       수정 UPDATE 자체가 같은 행에 거는 락이라 새로 늘어나는 대기는 없다.</li>
     * </ul>
     */
    @Query(value = "select id from posts where id = :id and deleted_at is null for no key update", nativeQuery = true)
    Optional<Long> lockLiveForNoKeyUpdate(@Param("id") Long id);

    /** 글 삭제용: FOR UPDATE. 진행 중인 댓글 작성(KEY SHARE)이 끝나길 기다리고, 이후의 댓글 작성은 삭제가 끝나길 기다리게 한다. */
    @Query(value = "select id from posts where id = :id and deleted_at is null for update", nativeQuery = true)
    Optional<Long> lockLiveForUpdate(@Param("id") Long id);
}
