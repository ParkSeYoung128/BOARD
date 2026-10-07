package io.github.parkseyoung128.board.like;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import io.github.parkseyoung128.board.Concurrent;
import io.github.parkseyoung128.board.IntegrationTest;

class LikeApiTest extends IntegrationTest {

    @Autowired
    ObjectMapper mapper;

    private long newPost(int likeCount) {
        return insertPost("글", "author", Instant.parse("2026-01-01T00:00:00Z"), likeCount);
    }

    private void toggle(long postId, String user) throws Exception {
        mvc.perform(post("/api/posts/" + postId + "/likes/toggle").header("x-user-id", user))
                .andExpect(status().isOk());
    }

    private int likeCount(long postId) {
        return jdbc.queryForObject("select like_count from posts where id = ?", Integer.class, postId);
    }

    private int likeRows(long postId) {
        return jdbc.queryForObject("select count(*) from post_likes where post_id = ?", Integer.class, postId);
    }

    @Test
    void 토글하면_켜지고_다시_토글하면_꺼진다() throws Exception {
        long id = newPost(10);
        mvc.perform(post("/api/posts/" + id + "/likes/toggle").header("x-user-id", "u1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isLiked").value(true))
                .andExpect(jsonPath("$.likeCount").value(11));
        mvc.perform(post("/api/posts/" + id + "/likes/toggle").header("x-user-id", "u1"))
                .andExpect(jsonPath("$.isLiked").value(false))
                .andExpect(jsonPath("$.likeCount").value(10));
    }

    @Test
    void 응답_필드는_isLiked와_likeCount_두_개뿐이다() throws Exception {
        long id = newPost(0);
        String body = mvc.perform(post("/api/posts/" + id + "/likes/toggle").header("x-user-id", "u1"))
                .andReturn().getResponse().getContentAsString();
        JsonNode json = mapper.readTree(body);
        assertThat(json.size()).isEqualTo(2);
        assertThat(json.has("isLiked")).isTrue();
        assertThat(json.has("likeCount")).isTrue();
    }

    @Test
    void isLiked는_사용자마다_따로이고_글_조회에_반영된다() throws Exception {
        long id = newPost(0);
        toggle(id, "u1");
        mvc.perform(get("/api/posts/" + id).header("x-user-id", "u1"))
                .andExpect(jsonPath("$.isLiked").value(true)).andExpect(jsonPath("$.likeCount").value(1));
        mvc.perform(get("/api/posts/" + id).header("x-user-id", "u2"))
                .andExpect(jsonPath("$.isLiked").value(false)).andExpect(jsonPath("$.likeCount").value(1));
        mvc.perform(post("/api/posts/" + id + "/likes/toggle").header("x-user-id", "u2"))
                .andExpect(jsonPath("$.likeCount").value(2));
    }

    @Test
    void 다른_글의_좋아요와_섞이지_않는다() throws Exception {
        long a = newPost(0);
        long b = newPost(0);
        toggle(a, "u1");
        assertThat(likeCount(a)).isEqualTo(1);
        assertThat(likeCount(b)).isZero();
    }

    @Test
    void 없는_글과_삭제된_글은_404() throws Exception {
        mvc.perform(post("/api/posts/999/likes/toggle")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        long id = newPost(3);
        jdbc.update("update posts set deleted_at = now() where id = ?", id);
        mvc.perform(post("/api/posts/" + id + "/likes/toggle").header("x-user-id", "u1"))
                .andExpect(status().isNotFound());
        assertThat(likeRows(id)).isZero();
        assertThat(likeCount(id)).isEqualTo(3);
    }

    @Test
    void 시드의_좋아요_수에서_시작해_요청자_기록은_비어_있다() throws Exception {
        long id = newPost(1796);
        mvc.perform(get("/api/posts/" + id).header("x-user-id", "u1"))
                .andExpect(jsonPath("$.likeCount").value(1796)).andExpect(jsonPath("$.isLiked").value(false));
        mvc.perform(post("/api/posts/" + id + "/likes/toggle").header("x-user-id", "u1"))
                .andExpect(jsonPath("$.likeCount").value(1797));
    }

    // ---- 동시성 ----

    @Test
    void 서로_다른_사용자_수십_명이_동시에_눌러도_카운트가_정확하다() throws Exception {
        long id = newPost(100);
        int users = 40;
        Concurrent.run(users, i -> toggle(id, "user" + i));

        assertThat(likeCount(id)).isEqualTo(100 + users);
        assertThat(likeRows(id)).isEqualTo(users);
    }

    @Test
    void 한_사용자가_홀수_번_연타하면_좋아요_상태로_끝나고_카운트가_어긋나지_않는다() throws Exception {
        long id = newPost(0);
        Concurrent.run(31, i -> toggle(id, "same"));

        assertThat(likeRows(id)).isEqualTo(1);
        assertThat(likeCount(id)).isEqualTo(1);
    }

    @Test
    void 한_사용자가_짝수_번_연타하면_원래대로_돌아온다() throws Exception {
        long id = newPost(5);
        Concurrent.run(20, i -> toggle(id, "same"));

        assertThat(likeRows(id)).isZero();
        assertThat(likeCount(id)).isEqualTo(5);
    }

    @Test
    void 여러_사용자가_동시에_각자_연타해도_카운트는_기록_수와_항상_일치한다() throws Exception {
        long id = newPost(7);
        int users = 10;
        int clicksEach = 5; // 홀수 → 모두 좋아요 상태로 끝난다
        Concurrent.run(users * clicksEach, i -> toggle(id, "user" + (i % users)));

        assertThat(likeRows(id)).isEqualTo(users);
        assertThat(likeCount(id)).isEqualTo(7 + likeRows(id));
    }

    @Test
    void 연타_중에도_카운트는_음수가_되지_않는다() throws Exception {
        long id = newPost(0);
        Concurrent.run(30, i -> toggle(id, "user" + (i % 3)));

        assertThat(likeCount(id)).isGreaterThanOrEqualTo(0);
        assertThat(likeCount(id)).isEqualTo(likeRows(id));
    }
}
