package io.github.parkseyoung128.board.comment;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.parkseyoung128.board.common.ApiException;
import io.github.parkseyoung128.board.common.Cursor;
import io.github.parkseyoung128.board.common.PageResponse;
import io.github.parkseyoung128.board.common.Requester;
import io.github.parkseyoung128.board.post.PostRepository;

@Service
@Transactional(readOnly = true)
public class CommentService {

    private static final String POST_NOT_FOUND = "게시글을 찾을 수 없습니다.";
    private static final String COMMENT_NOT_FOUND = "댓글을 찾을 수 없습니다.";

    private final CommentRepository comments;
    private final PostRepository posts;

    public CommentService(CommentRepository comments, PostRepository posts) {
        this.comments = comments;
        this.posts = posts;
    }

    /** 삭제된 글의 댓글은 조회되지 않는다(글이 없으면 404). */
    public PageResponse<CommentResponse> list(Long postId, Integer limit, String cursor) {
        requireLivePost(postId);
        int size = PageResponse.normalizeLimit(limit);
        Cursor after = Cursor.decode(cursor);
        PageRequest page = PageRequest.of(0, size + 1); // 한 건 더 읽어 다음 페이지 유무를 판단한다.
        List<Comment> rows = after == null
                ? comments.findFirstPage(postId, page)
                : comments.findPageAfter(postId, after.createdAt(), after.id(), page);
        List<CommentResponse> mapped = rows.stream().map(CommentResponse::from).toList();
        return PageResponse.of(mapped, size, comments.countLive(postId),
                row -> new Cursor(row.createdAt(), row.id()));
    }

    /**
     * 판정 순서: 404(글 없음/삭제됨) → 400(본문 검증).
     * 글 행에 KEY SHARE 락을 건 채로 댓글을 넣는다. 확인과 삽입 사이에 글 삭제가 끼어들면 삭제된 글에 댓글이 생기기 때문이다.
     * 글 삭제는 FOR UPDATE 를 걸어 이 락과 충돌하므로 둘 중 하나가 먼저 끝난 뒤에 다른 쪽이 진행된다.
     */
    @Transactional
    public CommentResponse create(Requester me, Long postId, CommentRequest request) {
        posts.lockLiveForKeyShare(postId).orElseThrow(() -> ApiException.notFound(POST_NOT_FOUND));
        Comment saved = comments.saveAndFlush(Comment.create(postId, request.content(), me.userId(), now()));
        return CommentResponse.from(saved);
    }

    /** 판정 순서: 404(댓글 없음/삭제됨, 또는 글이 삭제됨) → 403(소유자 아님). */
    @Transactional
    public void delete(Requester me, Long commentId) {
        Comment comment = comments.findByIdAndDeletedAtIsNull(commentId)
                .orElseThrow(() -> ApiException.notFound(COMMENT_NOT_FOUND));
        if (!posts.existsLive(comment.getPostId())) {
            throw ApiException.notFound(COMMENT_NOT_FOUND);
        }
        comment.assertOwner(me.userId());
        comment.softDelete(now());
    }

    private void requireLivePost(Long postId) {
        if (!posts.existsLive(postId)) {
            throw ApiException.notFound(POST_NOT_FOUND);
        }
    }

    /** created_at 은 초 단위로 절삭한다. 응답 형식과 DB 값이 같아야 커서가 어긋나지 않는다. */
    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.SECONDS);
    }
}
