package io.github.parkseyoung128.board.like;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import org.hibernate.annotations.Immutable;

/**
 * 좋아요 기록. JPQL 에서 "요청자가 좋아요를 눌렀는가(isLiked)"를 서브쿼리로 확인하기 위한 읽기 전용 매핑이다.
 * 쓰기(토글)는 원자성을 위해 SQL 로만 한다.
 */
@Entity
@Immutable
@Table(name = "post_likes")
@IdClass(PostLikeId.class)
public class PostLike {

    @Id
    @Column(name = "post_id")
    private Long postId;

    @Id
    @Column(name = "user_id", length = 50)
    private String userId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PostLike() {
    }

    public Long getPostId() {
        return postId;
    }

    public String getUserId() {
        return userId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
