package io.github.parkseyoung128.board.seed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import javax.sql.DataSource;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;

import io.github.parkseyoung128.board.Concurrent;
import io.github.parkseyoung128.board.IntegrationTest;

/** seed/seed.json 을 적재했을 때의 결과를 요구사항의 숫자와 대조한다. */
class SeedLoaderTest extends IntegrationTest {

    private static final int TOTAL_POSTS = 42;
    private static final int LIVE_POSTS = 39;
    private static final int TOTAL_COMMENTS = 2_076;
    private static final int LIVE_COMMENTS = 1_926;
    private static final int DELETED_POSTS = 3;
    private static final int DELETED_COMMENTS = 81;
    private static final long BUSIEST_POST = 2;
    private static final int BUSIEST_POST_COMMENTS = 1_411;

    @Autowired
    SeedLoader loader;

    @Autowired
    ObjectMapper mapper;

    @Autowired
    DataSource dataSource;

    @Value("${app.seed-path}")
    String seedPath;

    private Path path() {
        return Path.of(seedPath);
    }

    @BeforeEach
    void loadSeed() {
        loader.load(path());
    }

    private int count(String sql) {
        return jdbc.queryForObject(sql, Integer.class);
    }

    private JsonNode json(String body) throws Exception {
        return mapper.readTree(body);
    }

    @Test
    void 삭제를_뺀_게시글_39개가_한_페이지에_보인다() throws Exception {
        String body = mvc.perform(get("/api/posts?limit=50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(LIVE_POSTS))
                .andExpect(jsonPath("$.items", hasSize(LIVE_POSTS)))
                .andReturn().getResponse().getContentAsString();

        assertThat(json(body).get("nextCursor").isNull()).isTrue();
    }

    @Test
    void 시드의_id와_내용_좋아요_수가_그대로_적재된다() throws Exception {
        mvc.perform(get("/api/posts/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.title").value("수분크림 써보신 분 계세요?"))
                .andExpect(jsonPath("$.author").value("demo_user"))
                .andExpect(jsonPath("$.likeCount").value(1796))
                .andExpect(jsonPath("$.commentCount").value(2))
                .andExpect(jsonPath("$.isLiked").value(false))
                .andExpect(jsonPath("$.createdAt").value("2026-08-30T13:55:54Z"));
    }

    @Test
    void 화면에_보이는_댓글은_1926개이고_가장_많은_글은_1411개다() throws Exception {
        String feed = mvc.perform(get("/api/posts?limit=50")).andReturn().getResponse().getContentAsString();
        int sum = 0;
        for (JsonNode item : json(feed).get("items")) {
            sum += item.get("commentCount").asInt();
        }
        // 삭제된 댓글 81개와 삭제된 글에 달린 댓글은 세지 않는다
        assertThat(sum).isEqualTo(LIVE_COMMENTS);

        mvc.perform(get("/api/posts/" + BUSIEST_POST))
                .andExpect(jsonPath("$.commentCount").value(BUSIEST_POST_COMMENTS));
        mvc.perform(get("/api/posts/" + BUSIEST_POST + "/comments?limit=2"))
                .andExpect(jsonPath("$.total").value(BUSIEST_POST_COMMENTS))
                .andExpect(jsonPath("$.items", hasSize(2)));
    }

    @Test
    void 삭제된_글은_행으로는_남지만_어디서도_보이지_않는다() throws Exception {
        assertThat(count("select count(*) from posts")).isEqualTo(TOTAL_POSTS);
        assertThat(count("select count(*) from posts where deleted_at is not null")).isEqualTo(DELETED_POSTS);
        assertThat(count("select count(*) from comments")).isEqualTo(TOTAL_COMMENTS);
        assertThat(count("select count(*) from comments where deleted_at is not null")).isEqualTo(DELETED_COMMENTS);

        for (long deletedId : new long[] {9, 30, 31}) {
            mvc.perform(get("/api/posts/" + deletedId)).andExpect(status().isNotFound());
            mvc.perform(get("/api/posts/" + deletedId + "/comments")).andExpect(status().isNotFound());
            mvc.perform(post("/api/posts/" + deletedId + "/likes/toggle")).andExpect(status().isNotFound());
        }
    }

    @Test
    void 좋아요_기록은_비어_있다() {
        assertThat(count("select count(*) from post_likes")).isZero();
    }

    @Test
    void 두_번째_적재는_아무것도_바꾸지_않는다() {
        int likes = count("select coalesce(sum(like_count), 0) from posts");
        int deleted = count("select count(*) from posts where deleted_at is not null");

        loader.load(path());

        assertThat(count("select count(*) from posts")).isEqualTo(TOTAL_POSTS);
        assertThat(count("select count(*) from comments")).isEqualTo(TOTAL_COMMENTS);
        assertThat(count("select coalesce(sum(like_count), 0) from posts")).isEqualTo(likes);
        assertThat(count("select count(*) from posts where deleted_at is not null")).isEqualTo(deleted);
    }

    @Test
    void 이미_삭제한_글은_다시_적재해도_되살아나지_않는다() throws Exception {
        mvc.perform(delete("/api/posts/1")).andExpect(status().isNoContent());

        loader.load(path());

        mvc.perform(get("/api/posts/1")).andExpect(status().isNotFound());
        mvc.perform(get("/api/posts?limit=50")).andExpect(jsonPath("$.total").value(LIVE_POSTS - 1));
    }

    @Test
    void 다시_적재해도_좋아요_수가_시드_값으로_되돌아가지_않는다() throws Exception {
        mvc.perform(post("/api/posts/1/likes/toggle").header("x-user-id", "u1"))
                .andExpect(jsonPath("$.likeCount").value(1797));

        loader.load(path());

        mvc.perform(get("/api/posts/1").header("x-user-id", "u1"))
                .andExpect(jsonPath("$.likeCount").value(1797))
                .andExpect(jsonPath("$.isLiked").value(true));
    }

    @Test
    void 새_글과_댓글의_id는_시드의_최대_id_다음부터_발급된다() throws Exception {
        String created = mvc.perform(post("/api/posts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("title", "새 글", "content", "내용"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertThat(json(created).get("id").asLong()).isEqualTo(TOTAL_POSTS + 1L);

        String comment = mvc.perform(post("/api/posts/1/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("content", "새 댓글"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertThat(json(comment).get("id").asLong()).isEqualTo(TOTAL_COMMENTS + 1L);
    }

    @Test
    void 동시에_여러_번_적재해도_한_번만_적재된다() throws Exception {
        jdbc.execute("truncate table post_likes, comments, posts restart identity cascade");

        Concurrent.run(4, i -> loader.load(path()));

        assertThat(count("select count(*) from posts")).isEqualTo(TOTAL_POSTS);
        assertThat(count("select count(*) from comments")).isEqualTo(TOTAL_COMMENTS);
        assertThat(count("select count(*) from posts where deleted_at is not null")).isEqualTo(DELETED_POSTS);
        assertThat(count("select count(*) from comments where deleted_at is not null")).isEqualTo(DELETED_COMMENTS);
    }

    @Test
    void 시각은_초_단위로_절삭되어_저장된다() {
        SeedData data = new SeedData(
                List.of(new SeedData.PostRow(1_000, "소수 초", "내용", 0, "u", Instant.parse("2026-01-01T00:00:00.789Z"))),
                List.of(new SeedData.CommentRow(10_000, 1_000, "댓글", "u", Instant.parse("2026-01-01T00:00:01.456Z"))),
                List.of(), List.of());

        loader.load(data);

        Timestamp postTime = jdbc.queryForObject("select created_at from posts where id = 1000", Timestamp.class);
        Timestamp commentTime = jdbc.queryForObject("select created_at from comments where id = 10000", Timestamp.class);
        assertThat(postTime.getNanos()).isZero();
        assertThat(commentTime.getNanos()).isZero();
    }

    @Test
    void 적재는_advisory_lock이_풀릴_때까지_기다린다() throws Exception {
        jdbc.execute("truncate table post_likes, comments, posts restart identity cascade");

        CompletableFuture<Void> loading;
        try (Connection holder = dataSource.getConnection()) {
            holder.setAutoCommit(false);
            try (var statement = holder.prepareStatement("select pg_advisory_xact_lock(?)")) {
                statement.setLong(1, SeedLoader.LOCK_KEY);
                statement.execute();
            }

            loading = CompletableFuture.runAsync(() -> loader.load(path()));

            // PostgreSQL 이 실제로 advisory lock 대기 중인 세션을 보고할 때까지 기다린다(시간에 기대지 않는다)
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
            while (count("select count(*) from pg_locks where locktype = 'advisory' and not granted") == 0) {
                assertThat(System.nanoTime()).as("적재가 lock 대기에 들어가지 않았다").isLessThan(deadline);
                assertThat(loading).as("lock 을 쥐고 있는 동안 적재가 끝났다").isNotDone();
                Thread.sleep(20);
            }

            assertThat(loading).isNotDone();
            assertThat(count("select count(*) from posts")).isZero();

            holder.commit();
        }

        loading.get(30, TimeUnit.SECONDS);
        assertThat(count("select count(*) from posts")).isEqualTo(TOTAL_POSTS);
        assertThat(count("select count(*) from comments")).isEqualTo(TOTAL_COMMENTS);
    }
}
