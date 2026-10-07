package io.github.parkseyoung128.board.post;

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
 * 게시글. 삭제는 행을 지우지 않고 deleted_at 을 채우며, 엔티티 경로의 모든 조회에서
 * {@link SQLRestriction} 으로 삭제된 행을 제외한다. (JDBC/네이티브 쿼리에는 적용되지 않는다.)
 * 좋아요 수는 동시성 때문에 이 엔티티로 갱신하지 않고 원자적 SQL 로만 갱신한다.
 */
@Entity
@Table(name = "posts")
@SQLRestriction("deleted_at is null")
public class Post {

    public static final int TITLE_MAX_CODE_POINTS = 20;
    public static final int CONTENT_MAX_CODE_POINTS = 20_000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false, length = 50)
    private String author;

    @Column(name = "like_count", nullable = false)
    private int likeCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected Post() {
    }

    private Post(String title, String content, String author, Instant createdAt) {
        this.title = title;
        this.content = content;
        this.author = author;
        this.createdAt = createdAt;
    }

    public static Post create(String title, String content, String author, Instant now) {
        validate(title, content);
        return new Post(title, content, author, now);
    }

    public void edit(String title, String content) {
        validate(title, content);
        this.title = title;
        this.content = content;
    }

    public void assertOwner(String requester) {
        if (!author.equals(requester)) {
            throw ApiException.forbidden("본인이 작성한 글만 수정·삭제할 수 있습니다.");
        }
    }

    public void softDelete(Instant now) {
        this.deletedAt = now;
    }

    /** 제목은 코드포인트 기준 20자(이모지 1자), 공백만인 값은 거부한다. 입력값은 다듬지 않는다. */
    static void validate(String title, String content) {
        if (title == null || title.isBlank()) {
            throw ApiException.validation("제목을 입력해 주세요.");
        }
        if (title.codePointCount(0, title.length()) > TITLE_MAX_CODE_POINTS) {
            throw ApiException.validation("제목은 " + TITLE_MAX_CODE_POINTS + "자 이하여야 합니다.");
        }
        if (content == null || content.isBlank()) {
            throw ApiException.validation("내용을 입력해 주세요.");
        }
        if (content.codePointCount(0, content.length()) > CONTENT_MAX_CODE_POINTS) {
            throw ApiException.validation("내용은 " + CONTENT_MAX_CODE_POINTS + "자 이하여야 합니다.");
        }
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public String getAuthor() {
        return author;
    }

    public int getLikeCount() {
        return likeCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
