package io.github.parkseyoung128.board.comment;

import java.time.Instant;

/** 댓글 응답. 필드는 요구사항 예시 그대로이며 추가하지 않는다. */
public record CommentResponse(Long id, Long postId, String content, String author, Instant createdAt) {

    public static CommentResponse from(Comment comment) {
        return new CommentResponse(comment.getId(), comment.getPostId(), comment.getContent(),
                comment.getAuthor(), comment.getCreatedAt());
    }
}
