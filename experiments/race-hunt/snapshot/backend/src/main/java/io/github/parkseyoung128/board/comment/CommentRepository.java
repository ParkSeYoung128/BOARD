package io.github.parkseyoung128.board.comment;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 삭제된 댓글은 엔티티의 @SQLRestriction 이 제외한다. 정렬은 게시글 목록과 같은 (created_at DESC, id DESC). */
public interface CommentRepository extends JpaRepository<Comment, Long> {

    @Query("""
            select c from Comment c
            where c.postId = :postId
            order by c.createdAt desc, c.id desc
            """)
    List<Comment> findFirstPage(@Param("postId") Long postId, Pageable pageable);

    @Query("""
            select c from Comment c
            where c.postId = :postId
              and (c.createdAt < :cursorAt or (c.createdAt = :cursorAt and c.id < :cursorId))
            order by c.createdAt desc, c.id desc
            """)
    List<Comment> findPageAfter(@Param("postId") Long postId,
                                @Param("cursorAt") Instant cursorAt,
                                @Param("cursorId") long cursorId,
                                Pageable pageable);

    @Query("select count(c) from Comment c where c.postId = :postId")
    long countLive(@Param("postId") Long postId);

    Optional<Comment> findByIdAndDeletedAtIsNull(Long id);
}
