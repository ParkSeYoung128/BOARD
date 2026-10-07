package io.github.parkseyoung128.board.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.TimeUnit;

import javax.sql.DataSource;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import io.github.parkseyoung128.board.Concurrent;
import io.github.parkseyoung128.board.IntegrationTest;
import io.github.parkseyoung128.board.LockProbe;

/**
 * 글 삭제와 댓글 작성·좋아요·수정이 겹칠 때의 경계.
 * 규칙: 삭제가 커밋된 뒤에는 그 글에 댓글도 좋아요도 생기지 않고, 수정이 삭제를 되돌리지도 않는다.
 * 락을 쥔 상태를 직접 만드는 테스트는 "삭제 트랜잭션이 락을 쥔 채 커밋 전"인 상태를 직접 만들어, 어긋난 순서가 결정적으로 재현되게 한다.
 */
class PostDeleteRaceTest extends IntegrationTest {

    private static final String AUTHOR = "author";

    @Autowired
    DataSource dataSource;

    @Autowired
    ObjectMapper mapper;

    private long newPost(int likeCount) {
        return insertPost("글", AUTHOR, Instant.parse("2026-01-01T00:00:00Z"), likeCount);
    }

    private int commentRows(long postId) {
        return jdbc.queryForObject("select count(*) from comments where post_id = ?", Integer.class, postId);
    }

    private int likeRows(long postId) {
        return jdbc.queryForObject("select count(*) from post_likes where post_id = ?", Integer.class, postId);
    }

    private int likeCount(long postId) {
        return jdbc.queryForObject("select like_count from posts where id = ?", Integer.class, postId);
    }

    private int createComment(long postId, String user) throws Exception {
        return mvc.perform(post("/api/posts/" + postId + "/comments").header("x-user-id", user)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("content", "댓글"))))
                .andReturn().getResponse().getStatus();
    }

    private int toggleLike(long postId, String user) throws Exception {
        return mvc.perform(post("/api/posts/" + postId + "/likes/toggle").header("x-user-id", user))
                .andReturn().getResponse().getStatus();
    }

    private int updatePost(long postId) throws Exception {
        return mvc.perform(patch("/api/posts/" + postId).header("x-user-id", AUTHOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("title", "바뀜", "content", "바뀐 내용"))))
                .andReturn().getResponse().getStatus();
    }

    private int deletePost(long postId) throws Exception {
        return mvc.perform(delete("/api/posts/" + postId).header("x-user-id", AUTHOR))
                .andReturn().getResponse().getStatus();
    }

    /** 다른 스레드에서 요청을 시작한다. 요청이 락에 막혀 있으면 이 Future 는 끝나지 않는다. */
    private CompletableFuture<Integer> async(Callable<Integer> request) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return request.call();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        });
    }

    /** 삭제 트랜잭션이 글 행에 FOR UPDATE 를 잡고 deleted_at 을 채운 뒤 아직 커밋하지 않은 상태를 만든다. */
    private LockProbe deleteInProgress(long postId) throws Exception {
        LockProbe delete = LockProbe.hold(dataSource, "select id from posts where id = ? for update", postId);
        delete.execute("update posts set deleted_at = now() where id = ?", postId);
        return delete;
    }

    @Test
    void 글_삭제가_커밋되기_전에_들어온_댓글_작성은_삭제_후_404이고_저장되지_않는다() throws Exception {
        long postId = newPost(0);

        try (LockProbe delete = deleteInProgress(postId)) {
            CompletableFuture<Integer> comment = async(() -> createComment(postId, "bob"));

            assertThat(LockProbe.awaitLockWait(jdbc))
                    .as("댓글 작성이 글 행 락을 기다려야 한다. 기다리지 않고 진행하면 삭제된 글에 댓글이 생길 수 있다")
                    .isTrue();
            assertThat(comment).as("삭제가 끝나기 전에는 응답이 나오면 안 된다").isNotDone();

            delete.commit();

            assertThat(comment.get(10, TimeUnit.SECONDS)).isEqualTo(404);
        }
        assertThat(commentRows(postId)).isZero();
    }

    @Test
    void 글_삭제가_커밋되기_전에_들어온_좋아요는_삭제_후_404이고_기록이_남지_않는다() throws Exception {
        long postId = newPost(5);

        try (LockProbe delete = deleteInProgress(postId)) {
            CompletableFuture<Integer> like = async(() -> toggleLike(postId, "bob"));

            assertThat(LockProbe.awaitLockWait(jdbc)).as("좋아요 요청이 삭제 트랜잭션을 기다려야 한다").isTrue();
            assertThat(like).isNotDone();

            delete.commit();

            assertThat(like.get(10, TimeUnit.SECONDS)).isEqualTo(404);
        }
        // 404 로 롤백되어 기록도 카운트도 남지 않는다.
        assertThat(likeRows(postId)).isZero();
        assertThat(likeCount(postId)).isEqualTo(5);
    }

    @Test
    void 글_삭제는_진행_중인_댓글_작성이_끝날_때까지_기다린다() throws Exception {
        long postId = newPost(0);

        // 댓글 작성 트랜잭션이 글 행에 KEY SHARE 를 쥐고 있는 상태(락을 잡고 INSERT 전)
        try (LockProbe commenting = LockProbe.hold(dataSource,
                "select id from posts where id = ? for key share", postId)) {
            CompletableFuture<Integer> delete = async(() -> deletePost(postId));

            assertThat(LockProbe.awaitLockWait(jdbc))
                    .as("글 삭제가 진행 중인 댓글 작성을 기다려야 한다. 단순 UPDATE 는 KEY SHARE 와 충돌하지 않아 기다리지 않는다")
                    .isTrue();
            assertThat(delete).isNotDone();

            commenting.execute("insert into comments (post_id, content, author, created_at) "
                    + "values (?, '댓글', 'bob', now())", postId);
            commenting.commit();

            assertThat(delete.get(10, TimeUnit.SECONDS)).isEqualTo(204);
        }
        assertThat(commentRows(postId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select deleted_at is not null from posts where id = ?",
                Boolean.class, postId)).isTrue();
    }

    @Test
    void 글_삭제가_커밋되기_전에_들어온_수정은_삭제_후_404이고_글이_되살아나지_않는다() throws Exception {
        long postId = newPost(0);

        try (LockProbe delete = deleteInProgress(postId)) {
            CompletableFuture<Integer> update = async(() -> updatePost(postId));

            assertThat(LockProbe.awaitLockWait(jdbc)).as("수정 요청이 삭제 트랜잭션을 기다려야 한다").isTrue();
            assertThat(update).isNotDone();

            delete.commit();

            assertThat(update.get(10, TimeUnit.SECONDS)).isEqualTo(404);
        }
        // 수정이 읽어 둔 옛 값(deleted_at = null)으로 덮어쓰면 삭제가 취소된다.
        assertThat(jdbc.queryForObject("select deleted_at is not null from posts where id = ?",
                Boolean.class, postId)).isTrue();
        assertThat(jdbc.queryForObject("select title from posts where id = ?", String.class, postId)).isEqualTo("글");
    }

    @Test
    void 글_수정이_진행_중이어도_댓글_작성은_기다리지_않는다() throws Exception {
        long postId = newPost(0);

        // 수정 트랜잭션이 글 행에 FOR NO KEY UPDATE 를 쥐고 있는 상태. FOR UPDATE 였다면 댓글 작성이 여기서 막힌다.
        try (LockProbe editing = LockProbe.hold(dataSource,
                "select id from posts where id = ? for no key update", postId)) {
            CompletableFuture<Integer> comment = async(() -> createComment(postId, "bob"));

            assertThat(comment.get(5, TimeUnit.SECONDS)).isEqualTo(201);
            editing.rollback();
        }
        assertThat(commentRows(postId)).isEqualTo(1);
    }

    @Test
    void 삭제와_댓글_좋아요가_뒤섞여도_교착_없이_끝나고_결과가_일관된다() throws Exception {
        for (int round = 0; round < 5; round++) {
            long postId = newPost(10);
            int comments = 20;
            int likes = 20;
            ConcurrentLinkedQueue<Integer> commentStatuses = new ConcurrentLinkedQueue<>();
            ConcurrentLinkedQueue<Integer> likeStatuses = new ConcurrentLinkedQueue<>();
            ConcurrentLinkedQueue<Integer> deleteStatuses = new ConcurrentLinkedQueue<>();

            // 댓글·좋아요·삭제 요청을 같은 순간에 출발시킨다. 삭제는 중간쯤 순번에 둔다.
            int total = comments + likes + 1;
            Concurrent.run(total, i -> {
                if (i == total / 2) {
                    deleteStatuses.add(deletePost(postId));
                } else if (i % 2 == 0) {
                    commentStatuses.add(createComment(postId, "c" + i));
                } else {
                    likeStatuses.add(toggleLike(postId, "l" + i));
                }
            });

            // 어느 쪽이든 삭제보다 먼저면 성공, 나중이면 404 다. 500 이나 교착 같은 다른 결과는 없어야 한다.
            assertThat(deleteStatuses).containsExactly(204);
            assertThat(commentStatuses).isNotEmpty().allMatch(s -> s == 201 || s == 404);
            assertThat(likeStatuses).isNotEmpty().allMatch(s -> s == 200 || s == 404);

            // 성공 응답을 받은 것만 저장되어 있다. (404 를 받은 요청의 흔적이 남지 않는다.)
            long created = commentStatuses.stream().filter(s -> s == 201).count();
            long liked = likeStatuses.stream().filter(s -> s == 200).count();
            assertThat(commentRows(postId)).isEqualTo((int) created);
            assertThat(likeRows(postId)).isEqualTo((int) liked);
            assertThat(likeCount(postId)).isEqualTo(10 + (int) liked);
        }
    }
}
