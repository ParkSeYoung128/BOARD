package io.github.parkseyoung128.board.comment;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.SQLRestriction;

import io.github.parkseyoung128.board.common.ApiException;

/**
 * 댓글. 게시글과는 JPA 연관관계 없이 postId 값만 가진다(컬렉션 fetch join·N+1 방지).
 * 삭제는 deleted_at 을 채우는 soft delete 다.
 */
@Entity
@Table(name = "comments")
@SQLRestriction("deleted_at is null")
public class Comment {

    public static final int CONTENT_MAX_CODE_POINTS = 5_000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "post_id", nullable = false)
    private Long postId;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false, length = 50)
    private String author;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected Comment() {
    }

    private Comment(Long postId, String content, String author, Instant createdAt) {
        this.postId = postId;
        this.content = content;
        this.author = author;
        this.createdAt = createdAt;
    }

    public static Comment create(Long postId, String content, String author, Instant now) {
        validate(content);
        return new Comment(postId, content, author, now);
    }

    public void assertOwner(String requester) {
        if (!author.equals(requester)) {
            throw ApiException.forbidden("본인이 작성한 댓글만 삭제할 수 있습니다.");
        }
    }

    public void softDelete(Instant now) {
        this.deletedAt = now;
    }

    /** 공백만인 값은 거부하고 코드포인트 기준 상한을 둔다. 입력값은 다듬지 않는다. */
    static void validate(String content) {
        if (content == null || content.isBlank()) {
            throw ApiException.validation("댓글 내용을 입력해 주세요.");
        }
        if (content.codePointCount(0, content.length()) > CONTENT_MAX_CODE_POINTS) {
            throw ApiException.validation("댓글은 " + CONTENT_MAX_CODE_POINTS + "자 이하여야 합니다.");
        }
    }

    public Long getId() {
        return id;
    }

    public Long getPostId() {
        return postId;
    }

    public String getContent() {
        return content;
    }

    public String getAuthor() {
        return author;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
