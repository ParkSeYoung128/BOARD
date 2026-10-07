package io.github.parkseyoung128.board.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

class PageResponseTest {

    private static Cursor cursorOf(Integer n) {
        return new Cursor(Instant.ofEpochSecond(1_000L + n), n);
    }

    @Test
    void limit_기본값과_상한() {
        assertThat(PageResponse.normalizeLimit(null)).isEqualTo(20);
        assertThat(PageResponse.normalizeLimit(2)).isEqualTo(2);
        assertThat(PageResponse.normalizeLimit(50)).isEqualTo(50);
        assertThat(PageResponse.normalizeLimit(500)).isEqualTo(50);
        assertThrows(ApiException.class, () -> PageResponse.normalizeLimit(0));
        assertThrows(ApiException.class, () -> PageResponse.normalizeLimit(-3));
    }

    @Test
    void limit보다_한_건_더_있으면_nextCursor를_만든다() {
        PageResponse<Integer> page = PageResponse.of(List.of(3, 2, 1), 2, 10, PageResponseTest::cursorOf);
        assertThat(page.items()).containsExactly(3, 2);
        assertThat(page.total()).isEqualTo(10);
        assertThat(Cursor.decode(page.nextCursor())).isEqualTo(cursorOf(2));
    }

    @Test
    void 정확히_limit건이면_마지막_페이지라서_nextCursor는_null() {
        PageResponse<Integer> page = PageResponse.of(List.of(2, 1), 2, 2, PageResponseTest::cursorOf);
        assertThat(page.items()).containsExactly(2, 1);
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void 결과가_없어도_정상_응답() {
        PageResponse<Integer> page = PageResponse.of(List.of(), 20, 0, PageResponseTest::cursorOf);
        assertThat(page.items()).isEmpty();
        assertThat(page.nextCursor()).isNull();
    }
}
