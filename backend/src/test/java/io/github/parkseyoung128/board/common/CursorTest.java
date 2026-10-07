package io.github.parkseyoung128.board.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.Base64;

import org.junit.jupiter.api.Test;

class CursorTest {

    @Test
    void 인코딩한_커서를_그대로_복원한다() {
        Cursor cursor = new Cursor(Instant.parse("2026-08-30T13:55:54Z"), 42L);
        assertThat(Cursor.decode(cursor.encode())).isEqualTo(cursor);
    }

    @Test
    void 커서는_패딩_없는_base64url_이다() {
        String encoded = new Cursor(Instant.ofEpochSecond(1_788_100_000L), 12L).encode();
        assertThat(encoded).doesNotContain("=", "+", "/");
        assertThat(new String(Base64.getUrlDecoder().decode(encoded))).isEqualTo("1788100000_12");
    }

    @Test
    void 비어있으면_첫_페이지로_본다() {
        assertThat(Cursor.decode(null)).isNull();
        assertThat(Cursor.decode("  ")).isNull();
    }

    @Test
    void 해석할_수_없는_커서는_INVALID_CURSOR() {
        String noUnderscore = Base64.getUrlEncoder().withoutPadding().encodeToString("abc".getBytes());
        String notNumber = Base64.getUrlEncoder().withoutPadding().encodeToString("x_y".getBytes());
        String zeroId = Base64.getUrlEncoder().withoutPadding().encodeToString("100_0".getBytes());
        for (String bad : new String[] {"!!!", noUnderscore, notNumber, zeroId}) {
            ApiException e = assertThrows(ApiException.class, () -> Cursor.decode(bad), bad);
            assertThat(e.getCode()).isEqualTo("INVALID_CURSOR");
        }
    }
}
