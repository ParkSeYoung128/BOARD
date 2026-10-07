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
}
