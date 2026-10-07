package io.github.parkseyoung128.board.common;

/** 오류 응답 본문. */
public record ApiError(String code, String message) {
}
