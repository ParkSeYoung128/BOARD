package io.github.parkseyoung128.board.common;

import java.nio.charset.StandardCharsets;
import java.time.DateTimeException;
import java.time.Instant;
import java.util.Base64;

/**
 * keyset 페이지네이션 커서: 마지막으로 내려준 항목의 (createdAt, id).
 * 클라이언트에는 불투명 문자열(base64url("{epochSecond}_{id}"))로만 노출한다.
 * createdAt 은 초 단위로 저장되므로 커서 왕복에서 값이 어긋나지 않는다.
 */
public record Cursor(Instant createdAt, long id) {

    public String encode() {
        String raw = createdAt.getEpochSecond() + "_" + id;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /** null/빈 문자열이면 null(첫 페이지). 해석할 수 없으면 INVALID_CURSOR. */
    public static Cursor decode(String encoded) {
        if (encoded == null || encoded.isBlank()) {
            return null;
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(encoded.strip()), StandardCharsets.UTF_8);
            String[] parts = raw.split("_", 2);
            if (parts.length != 2) {
                throw ApiException.invalidCursor();
            }
            long epochSecond = Long.parseLong(parts[0]);
            long id = Long.parseLong(parts[1]);
            if (id <= 0) {
                throw ApiException.invalidCursor();
            }
            return new Cursor(Instant.ofEpochSecond(epochSecond), id);
        } catch (IllegalArgumentException | DateTimeException e) {
            throw ApiException.invalidCursor();
        }
    }
}
