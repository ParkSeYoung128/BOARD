package io.github.parkseyoung128.board.post;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.function.Consumer;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import io.github.parkseyoung128.board.IntegrationTest;

/**
 * 글 수정·삭제가 그 사이에 반영된 좋아요 수를 옛 값으로 덮어쓰지 않는지 확인한다.
 * Hibernate 는 기본으로 모든 컬럼을 UPDATE 하므로, 글을 읽은 뒤 다른 요청의 좋아요가 먼저 반영되면
 * 수정·삭제가 읽어 둔 값으로 like_count 를 되돌릴 수 있다. 같은 트랜잭션 안에서 그 상황을 만들어 결정적으로 재현한다.
 */
class PostLikeCountIntegrityTest extends IntegrationTest {

    private static final Instant CREATED_AT = Instant.parse("2026-01-01T00:00:00Z");

    @Autowired
    PostRepository posts;

    @Autowired
    PlatformTransactionManager transactionManager;

    private int likeCount(long postId) {
        return jdbc.queryForObject("select like_count from posts where id = ?", Integer.class, postId);
    }

    /** 글을 읽은 뒤(like_count 를 읽어 둠) 다른 요청의 좋아요가 반영된 상황에서 action 을 실행한다. */
    private void withLikeAppliedAfterRead(long postId, Consumer<Post> action) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            Post post = posts.findByIdAndDeletedAtIsNull(postId).orElseThrow();
            jdbc.update("update posts set like_count = like_count + 1 where id = ?", postId);
            action.accept(post);
            posts.flush();
        });
    }

    @Test
    void 글을_수정해도_그사이_반영된_좋아요_수가_유지된다() {
        long id = insertPost("글", "author", CREATED_AT, 10);

        withLikeAppliedAfterRead(id, post -> post.edit("새 제목", "새 내용"));

        assertThat(likeCount(id)).isEqualTo(11);
        assertThat(jdbc.queryForObject("select title from posts where id = ?", String.class, id)).isEqualTo("새 제목");
    }

    @Test
    void 글을_삭제해도_그사이_반영된_좋아요_수가_유지된다() {
        long id = insertPost("글", "author", CREATED_AT, 10);

        withLikeAppliedAfterRead(id, post -> post.softDelete(Instant.parse("2026-01-02T00:00:00Z")));

        assertThat(likeCount(id)).isEqualTo(11);
        assertThat(jdbc.queryForObject("select deleted_at is not null from posts where id = ?", Boolean.class, id))
                .isTrue();
    }
}
