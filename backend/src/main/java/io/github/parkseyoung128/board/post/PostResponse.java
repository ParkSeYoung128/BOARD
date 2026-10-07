package io.github.parkseyoung128.board.post;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 게시글 응답. 필드는 요구사항 예시 그대로이며 추가하지 않는다.
 * isLiked 는 Jackson 이 "liked" 로 바꾸지 않도록 키를 명시한다.
 */
public record PostResponse(
        Long id,
        String title,
        String content,
        Integer likeCount,
        Long commentCount,
        @JsonProperty("isLiked") Boolean isLiked,
        String author,
        Instant createdAt) {
}
