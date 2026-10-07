package io.github.parkseyoung128.board.post;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import io.github.parkseyoung128.board.common.ApiException;

class PostValidationTest {

    @Test
    void 제목_스무_자는_통과_스물한_자는_실패() {
        assertDoesNotThrow(() -> Post.validate("가".repeat(20), "내용"));
        assertThrows(ApiException.class, () -> Post.validate("가".repeat(21), "내용"));
    }

    @Test
    void 이모지는_코드포인트_한_자로_센다() {
        // "😀" 는 UTF-16 으로 2칸이지만 1자다.
        assertDoesNotThrow(() -> Post.validate("😀".repeat(20), "내용"));
        assertThrows(ApiException.class, () -> Post.validate("😀".repeat(21), "내용"));
    }

    @Test
    void 공백뿐이거나_null이면_실패() {
        assertThrows(ApiException.class, () -> Post.validate("   ", "내용"));
        assertThrows(ApiException.class, () -> Post.validate("제목", " \n\t"));
        assertThrows(ApiException.class, () -> Post.validate(null, "내용"));
        assertThrows(ApiException.class, () -> Post.validate("제목", null));
    }

    @Test
    void 내용_상한() {
        assertDoesNotThrow(() -> Post.validate("제목", "a".repeat(Post.CONTENT_MAX_CODE_POINTS)));
        assertThrows(ApiException.class,
                () -> Post.validate("제목", "a".repeat(Post.CONTENT_MAX_CODE_POINTS + 1)));
    }
}
