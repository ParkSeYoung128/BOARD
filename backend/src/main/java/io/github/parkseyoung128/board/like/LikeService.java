package io.github.parkseyoung128.board.like;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.parkseyoung128.board.common.ApiException;
import io.github.parkseyoung128.board.common.Requester;
import io.github.parkseyoung128.board.post.PostRepository;

@Service
public class LikeService {

    private static final String NOT_FOUND = "게시글을 찾을 수 없습니다.";
    private static final int MAX_ATTEMPTS = 3;

    private final PostRepository posts;
    private final PostLikeRepository likes;

    public LikeService(PostRepository posts, PostLikeRepository likes) {
        this.posts = posts;
        this.likes = likes;
    }

    /**
     * 좋아요 토글. 한 트랜잭션에서
     * 1) 기록을 새로 넣었으면(+1) → 좋아요, 2) 이미 있어서 지웠으면(-1) → 취소.
     * 같은 사용자가 연타해도 (글, 사용자) 단위 advisory lock 이 요청을 한 줄로 세워 모든 클릭이 정확히 한 번씩 반영되고,
     * 카운터는 원자적 UPDATE 로 갱신된다.
     * 어느 경우에도 "기록 한 건의 삽입/삭제"와 "카운트 ±1"이 한 트랜잭션에서 짝을 이루므로
     * like_count 는 (초기 값 + post_likes 행 수)와 항상 일치한다.
     */
    @Transactional
    public LikeResult toggle(Requester me, Long postId) {
        if (!posts.existsLive(postId)) {
            throw ApiException.notFound(NOT_FOUND);
        }
        likes.lockToggle(postId, me.userId());
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            if (likes.insertIfAbsent(postId, me.userId())) {
                return new LikeResult(true, requireCount(likes.increment(postId)));
            }
            if (likes.delete(postId, me.userId())) {
                return new LikeResult(false, requireCount(likes.decrement(postId)));
            }
            // lock 으로 같은 사용자의 요청은 겹치지 않으므로 사실상 도달하지 않는 안전장치
        }
        return new LikeResult(likes.exists(postId, me.userId()), requireCount(likes.likeCount(postId)));
    }

    private static int requireCount(Integer count) {
        if (count == null) {
            throw ApiException.notFound(NOT_FOUND);
        }
        return count;
    }
}
