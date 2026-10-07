package io.github.parkseyoung128.board.seed;

import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** seed.json 의 구조. 목록이 비어 있거나 없어도 빈 목록으로 다룬다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SeedData(
        List<PostRow> posts,
        List<CommentRow> comments,
        List<Long> deletedPostIds,
        List<Long> deletedCommentIds) {

    public SeedData {
        posts = posts == null ? List.of() : posts;
        comments = comments == null ? List.of() : comments;
        deletedPostIds = deletedPostIds == null ? List.of() : deletedPostIds;
        deletedCommentIds = deletedCommentIds == null ? List.of() : deletedCommentIds;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PostRow(long id, String title, String content, int likeCount, String author, Instant createdAt) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CommentRow(long id, long postId, String content, String author, Instant createdAt) {
    }
}
