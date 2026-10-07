package io.github.parkseyoung128.board.common;

/** 요청한 사용자. 로그인이 없으므로 x-user-id 값이 곧 사용자다. */
public record Requester(String userId) {
}
