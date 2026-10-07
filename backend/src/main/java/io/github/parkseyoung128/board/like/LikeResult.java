package io.github.parkseyoung128.board.like;

import com.fasterxml.jackson.annotation.JsonProperty;

/** 좋아요 토글 결과. isLiked 는 요청자 기준. */
public record LikeResult(@JsonProperty("isLiked") Boolean isLiked, Integer likeCount) {
}
