package io.github.parkseyoung128.board.like;

import java.io.Serializable;
import java.util.Objects;

/** post_likes 복합 키 (post_id, user_id). */
public class PostLikeId implements Serializable {

    private Long postId;
    private String userId;

    public PostLikeId() {
    }

    public PostLikeId(Long postId, String userId) {
        this.postId = postId;
        this.userId = userId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PostLikeId other)) {
            return false;
        }
        return Objects.equals(postId, other.postId) && Objects.equals(userId, other.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(postId, userId);
    }
}
