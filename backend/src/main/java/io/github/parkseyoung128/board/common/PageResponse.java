package io.github.parkseyoung128.board.common;

import java.util.List;
import java.util.function.Function;

/** 목록 응답 봉투. total 은 조건에 맞는 전체 개수, nextCursor 는 마지막 페이지면 null. */
public record PageResponse<T>(List<T> items, long total, String nextCursor) {

    public static final int DEFAULT_LIMIT = 20;
    public static final int MAX_LIMIT = 50;

    /** 기본 20, 최대 50(초과는 50으로 보정), 1 미만은 400. */
    public static int normalizeLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }
        if (limit < 1) {
            throw ApiException.validation("limit 은 1 이상이어야 합니다.");
        }
        return Math.min(limit, MAX_LIMIT);
    }

    /**
     * size + 1 건을 조회한 결과(rows)에서 size 건만 잘라 담는다.
     * 초과분이 있으면 마지막으로 내려준 항목으로 다음 커서를 만든다.
     */
    public static <T> PageResponse<T> of(List<T> rows, int size, long total, Function<T, Cursor> cursorOf) {
        boolean hasMore = rows.size() > size;
        List<T> items = hasMore ? List.copyOf(rows.subList(0, size)) : List.copyOf(rows);
        String next = hasMore ? cursorOf.apply(items.get(size - 1)).encode() : null;
        return new PageResponse<>(items, total, next);
    }
}
