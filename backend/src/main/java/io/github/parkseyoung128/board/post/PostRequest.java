package io.github.parkseyoung128.board.post;

/** 게시글 작성·수정 요청 본문. */
public record PostRequest(String title, String content) {
}
