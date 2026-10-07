package io.github.parkseyoung128.board.post;

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

@Service
@Transactional(readOnly = true)
public class PostService {

    private static final String NOT_FOUND = "게시글을 찾을 수 없습니다.";

    private final PostRepository posts;

    public PostService(PostRepository posts) {
        this.posts = posts;
    }

    public PageResponse<PostResponse> list(Requester me, Integer limit, String cursor) {
        int size = PageResponse.normalizeLimit(limit);
        Cursor after = Cursor.decode(cursor);
        PageRequest page = PageRequest.of(0, size + 1); // 한 건 더 읽어 다음 페이지 유무를 판단한다.
        List<PostResponse> rows = after == null
                ? posts.findFirstPage(me.userId(), page)
                : posts.findPageAfter(me.userId(), after.createdAt(), after.id(), page);
        return PageResponse.of(rows, size, posts.countLive(), row -> new Cursor(row.createdAt(), row.id()));
    }

    public PostResponse get(Requester me, Long id) {
        return posts.findView(id, me.userId()).orElseThrow(() -> ApiException.notFound(NOT_FOUND));
    }

    @Transactional
    public PostResponse create(Requester me, PostRequest request) {
        Post saved = posts.saveAndFlush(Post.create(request.title(), request.content(), me.userId(), now()));
        return get(me, saved.getId());
    }

    /** 판정 순서: 404(없음/삭제됨) → 403(소유자 아님) → 400(본문 검증). */
    @Transactional
    public PostResponse update(Requester me, Long id, PostRequest request) {
        // 삭제가 먼저 커밋되면 404 가 된다. 락 없이 읽은 값으로 UPDATE 하면 deleted_at 을 덮어써 삭제된 글이 되살아난다.
        posts.lockLiveForNoKeyUpdate(id).orElseThrow(() -> ApiException.notFound(NOT_FOUND));
        Post post = findLive(id);
        post.assertOwner(me.userId());
        post.edit(request.title(), request.content());
        posts.flush();
        return get(me, id);
    }

    @Transactional
    public void delete(Requester me, Long id) {
        // 진행 중인 댓글 작성이 끝나길 기다리고, 이후의 댓글 작성은 삭제가 끝나길 기다리게 한다. (PostRepository.lockLiveForKeyShare)
        posts.lockLiveForUpdate(id).orElseThrow(() -> ApiException.notFound(NOT_FOUND));
        Post post = findLive(id);
        post.assertOwner(me.userId());
        post.softDelete(now());
    }

    private Post findLive(Long id) {
        return posts.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> ApiException.notFound(NOT_FOUND));
    }

    /** created_at 은 초 단위로 절삭한다. 응답 형식과 DB 값이 같아야 커서가 어긋나지 않는다. */
    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.SECONDS);
    }
}
