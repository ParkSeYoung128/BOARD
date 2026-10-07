package io.github.parkseyoung128.board.comment;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import io.github.parkseyoung128.board.common.ApiException;

class CommentValidationTest {

    @Test
    void 공백뿐이거나_null이면_실패() {
        assertThrows(ApiException.class, () -> Comment.validate("   "));
        assertThrows(ApiException.class, () -> Comment.validate("\n\t"));
        assertThrows(ApiException.class, () -> Comment.validate(null));
    }

    @Test
    void 상한은_코드포인트_기준() {
        assertDoesNotThrow(() -> Comment.validate("a".repeat(Comment.CONTENT_MAX_CODE_POINTS)));
        assertThrows(ApiException.class,
                () -> Comment.validate("a".repeat(Comment.CONTENT_MAX_CODE_POINTS + 1)));
        // 이모지는 UTF-16 으로 2칸이지만 1자다.
        assertDoesNotThrow(() -> Comment.validate("😀".repeat(Comment.CONTENT_MAX_CODE_POINTS)));
        assertThrows(ApiException.class,
                () -> Comment.validate("😀".repeat(Comment.CONTENT_MAX_CODE_POINTS + 1)));
    }

    @Test
    void 입력값은_다듬지_않는다() {
        Comment comment = Comment.create(1L, "  앞뒤 공백 \n", "alice", java.time.Instant.EPOCH);
        org.junit.jupiter.api.Assertions.assertEquals("  앞뒤 공백 \n", comment.getContent());
    }
}
